'use strict';

const g_db = require('@arangodb').db;
const g_lib = require('./support');

module.exports = (function() {
    var obj = {};

    /** @brief Pre-process data/collection IDs for permissions and required data
     *
     * Examine data and collections for proper permissions for the given mode and
     * recursively process items (data/collections) in included collections. Does
     * not resolve IDs. On success, returns lists of data records for globus and
     * external data, as well as records without data. Also returns a flat list of
     * all collections. In delete mode, for data records in collections, only data
     * that isn't linked elsewhere are returned.
     */
    obj.preprocessItems = function(a_client, a_new_owner_id, a_ids, a_mode) {
        //console.log( "preprocessItems start" );
        var ctxt = {
            client: {
                _id: a_client._id,
                is_admin: a_client.is_admin
            },
            new_owner: a_new_owner_id,
            mode: a_mode,
            has_pub: false,
            coll_perm: 0,
            data_perm: 0,
            coll: [],
            glob_data: [],
            ext_data: [],
            visited: {}
        };

        switch (a_mode) {
            case g_lib.TT_DATA_GET:
                ctxt.data_perm = g_lib.PERM_RD_DATA;
                ctxt.coll_perm = g_lib.PERM_LIST;
                break;
            case g_lib.TT_DATA_PUT:
                ctxt.data_perm = g_lib.PERM_WR_DATA;
                // Collections not allowed
                break;
            case g_lib.TT_REC_ALLOC_CHG:
                // Must be data owner OR if owned by a project, the project or
                // an admin, or the creator.
                ctxt.coll_perm = g_lib.PERM_LIST;
                break;
            case g_lib.TT_REC_OWNER_CHG:
                // Must have all read+delete, or be owner or creator OR, if owned by a project, the project or
                // an admin.
                ctxt.data_perm = g_lib.PERM_RD_ALL | g_lib.PERM_DELETE;
                ctxt.coll_perm = g_lib.PERM_LIST;
                break;
            case g_lib.TT_REC_DEL:
                ctxt.data_perm = g_lib.PERM_DELETE;
                ctxt.coll_perm = g_lib.PERM_DELETE;
                break;
            case g_lib.TT_DATA_EXPORT:
                ctxt.data_perm = g_lib.PERM_RD_REC | g_lib.PERM_RD_META;
                ctxt.coll_perm = g_lib.PERM_LIST;
                break;
        }

        ctxt.comb_perm = ctxt.data_perm | ctxt.coll_perm;

        obj._preprocessItemsRecursive(ctxt, a_ids, null, null);

        var i;

        // For deletion, must further process data records to determine if they
        // are to be deleted or not (if they are linked elsewhere)
        if (a_mode == g_lib.TT_REC_DEL) {
            var cnt, data, remove = [];

            for (i in ctxt.ext_data) {
                data = ctxt.ext_data[i];
                cnt = ctxt.visited[data.id];
                if (cnt == -1 || cnt == g_lib.getDataCollectionLinkCount(data.id)) {
                    //console.log("Del ext rec",data.id,",cnt:",cnt,", links:", lcnt );
                    remove.push(data);
                }
            }

            ctxt.ext_data = remove;
            remove = [];

            for (i in ctxt.glob_data) {
                data = ctxt.glob_data[i];
                cnt = ctxt.visited[data.id];
                if (cnt == -1 || cnt == g_lib.getDataCollectionLinkCount(data.id)) {
                    //console.log("Del man rec",data.id,",cnt:",cnt,", links:", lcnt );
                    remove.push(data);
                }
            }

            ctxt.glob_data = remove;
        }

        delete ctxt.client;
        delete ctxt.visited;
        delete ctxt.data_perm;
        delete ctxt.coll_perm;
        delete ctxt.comb_perm;

        //console.log( "preprocessItems finished" );

        return ctxt;
    };


    /**
     * @brief Recursive preprocessing of data/collections for data operations
     * @param a_ctxt - Recursion context object
     * @param a_ids - Current list of data/collection IDs to process
     * @param a_perm - Inherited permission (undefined initially)
     * 
     * This function pre-processes with optimized permission verification by
     * using a depth-first analysis of collections. If the required permission
     * is satisfied via inherited ACLs, then no further permission checks are
     * required below that point. The end result is a flat list of collections
     * and data segregated into those with Globus data (regardless of data
     * size) and those with external data.
     */
    obj._preprocessItemsRecursive = function(a_ctxt, a_ids, a_data_perm, a_coll_perm) {
        var i, id, ids, is_coll, doc, perm, ok, data_perm, coll_perm;

        for (i in a_ids) {
            id = a_ids[i];

            //console.log( "preprocessItem", id );

            if (id.charAt(0) == 'c') {
                if (a_ctxt.mode == g_lib.TT_DATA_PUT)
                    throw [g_lib.ERR_INVALID_PARAM, "Collections not supported for PUT operations."];
                is_coll = true;
            } else {
                is_coll = false;
            }

            // Skip / count data already record visited
            if (!is_coll) {
                if (id in a_ctxt.visited) {
                    if (a_ctxt.mode == g_lib.TT_REC_DEL) {
                        var cnt = a_ctxt.visited[id];
                        if (cnt != -1)
                            a_ctxt.visited[id] = cnt + 1;
                    }
                    continue;
                } else {
                    // NOTE: a_data_perm is null, then this indicates a record has been specified explicitly, which
                    // is indicated with a cnt of -1 (and will be deleted regardless of other collection links)
                    a_ctxt.visited[id] = (a_data_perm == null ? -1 : 1);
                }
            }

            if (!g_db._exists(id))
                throw [g_lib.ERR_INVALID_PARAM, (is_coll ? "Collection '" : "Data record '") + id + "' does not exist."];

            doc = g_db._document(id);

            if (doc.public)
                a_ctxt.has_pub = true;

            // Check permissions

            if (is_coll) {
                data_perm = (a_data_perm == null ? 0 : a_data_perm);
                coll_perm = (a_coll_perm == null ? 0 : a_coll_perm);

                // Make sure user isn't trying to delete root
                if (doc.is_root && a_ctxt.mode == g_lib.TT_REC_DEL)
                    throw [g_lib.ERR_PERM_DENIED, "Cannot delete root collection " + id];

                /* If either collection OR data permission are not satisfied,
                will need to evaluate grant and inherited collection
                permissions. Local ACLs could apply additional inherited
                permissions.*/

                if (((coll_perm & a_ctxt.coll_perm) != a_ctxt.coll_perm) ||
                    ((data_perm & a_ctxt.data_perm) != a_ctxt.data_perm)) {

                    if (!g_lib.hasAdminPermObjectLoaded(a_ctxt.client, doc)) {

                        if (a_coll_perm != null) // Already have inherited permission, don't ask again
                            perm = g_lib.getPermissionsLocal(a_ctxt.client._id, doc);
                        else
                            perm = g_lib.getPermissionsLocal(a_ctxt.client._id, doc, true, a_ctxt.comb_perm);

                        /* Note: collection inherit-grant permissions do not apply to the collection itself - only to
                        items linked beneath the collection. Thus permission checks at this point should only
                        be against granted permissions and permissions inherited from parent collections (which
                        is available in perm.inherited)
                        */

                        if (((perm.grant | perm.inherited) & a_ctxt.coll_perm) != a_ctxt.coll_perm) {
                            throw [g_lib.ERR_PERM_DENIED, "Permission denied for collection " + id];
                        }

                        // inherited and inhgrant perms only apply to recursion
                        data_perm |= (perm.inhgrant | perm.inherited);
                        coll_perm |= (perm.inhgrant | perm.inherited);
                    } else {
                        data_perm = a_ctxt.data_perm;
                        coll_perm = a_ctxt.coll_perm;
                    }
                }

                a_ctxt.coll.push(id);
                ids = g_db._query("for v in 1..1 outbound @coll item return v._id", {
                    coll: id
                }).toArray();
                obj._preprocessItemsRecursive(a_ctxt, ids, data_perm, coll_perm);
            } else {
                // Data record

                if (a_ctxt.mode == g_lib.TT_REC_ALLOC_CHG) {
                    // Must be data owner or project admin
                    if (doc.owner != a_ctxt.client._id) {
                        if (doc.owner.startsWith("p/")) {
                            if (!(doc.owner in a_ctxt.visited)) {
                                if (g_lib.hasManagerPermProj(a_ctxt.client, doc.owner)) {
                                    // Put project ID in visited to avoid checking permissions again
                                    a_ctxt.visited[doc.owner] = 1;
                                } else {
                                    throw [g_lib.ERR_PERM_DENIED, "Permission denied for data record " + id];
                                }
                            }
                        } else {
                            throw [g_lib.ERR_PERM_DENIED, "Permission denied for data record " + id];
                        }
                    }
                } else if (a_ctxt.mode == g_lib.TT_REC_OWNER_CHG) {
                    // Must be data owner or creator OR if owned by a project, the project or
                    // an admin.
                    if (doc.owner != a_ctxt.client._id && doc.creator != a_ctxt.client._id && !a_ctxt.client.is_admin) {
                        ok = false;

                        if (doc.owner.startsWith("p/")) {
                            if (!(doc.owner in a_ctxt.visited)) {
                                if (g_lib.hasManagerPermProj(a_ctxt.client, doc.owner)) {
                                    // Put project ID in visited to avoid checking permissions again
                                    a_ctxt.visited[doc.owner] = 1;
                                    ok = true;
                                }
                            } else {
                                ok = true;
                            }
                        }

                        if (!ok && (a_data_perm & a_ctxt.data_perm) != a_ctxt.data_perm) {
                            if (a_data_perm != null) // Already have inherited permission, don't ask again
                                perm = g_lib.getPermissionsLocal(a_ctxt.client._id, doc);
                            else
                                perm = g_lib.getPermissionsLocal(a_ctxt.client._id, doc, true, a_ctxt.data_perm);

                            if (((perm.grant | perm.inherited) & a_ctxt.data_perm) != a_ctxt.data_perm)
                                throw [g_lib.ERR_PERM_DENIED, "Permission denied for data record " + id];
                        }
                    }
                } else {
                    if ((a_data_perm & a_ctxt.data_perm) != a_ctxt.data_perm) {
                        if (!g_lib.hasAdminPermObjectLoaded(a_ctxt.client, doc)) {
                            if (a_data_perm != null) // Already have inherited permission, don't ask again
                                perm = g_lib.getPermissionsLocal(a_ctxt.client._id, doc);
                            else
                                perm = g_lib.getPermissionsLocal(a_ctxt.client._id, doc, true, a_ctxt.data_perm);

                            if (((perm.grant | perm.inherited) & a_ctxt.data_perm) != a_ctxt.data_perm) {
                                throw [g_lib.ERR_PERM_DENIED, "Permission denied for data record " + id];
                            }
                        }
                    }
                }

                if (doc.external) {
                    if (a_ctxt.mode == g_lib.TT_DATA_PUT)
                        throw [g_lib.ERR_INVALID_PARAM, "Cannot upload to external data on record '" + doc.id + "'."];

                    a_ctxt.ext_data.push({
                        _id: id,
                        id: id,
                        title: doc.title,
                        owner: doc.owner,
                        size: doc.size,
                        source: doc.source,
                        ext: doc.ext
                    });
                } else if (a_ctxt.mode != g_lib.TT_DATA_GET || doc.size) {
                    a_ctxt.glob_data.push({
                        _id: id,
                        id: id,
                        title: doc.title,
                        owner: doc.owner,
                        size: doc.size,
                        source: doc.source,
                        ext: doc.ext
                    });
                }
            }
        }
    };

    obj._processTaskDeps = function(a_task_id, a_ids, a_lock_lev, a_owner_lock_lev, a_context) {
        var i, id, lock, locks, block = new Set(),
            owner, owners = new Set();
        for (i in a_ids) {
            id = a_ids[i];

            owner = g_db.owner.firstExample({
                _from: id
            });
            if (owner)
                owners.add(owner._to);

            // Gather other tasks with priority over this new one
            locks = g_db.lock.byExample({
                _to: id
            });
            while (locks.hasNext()) {
                lock = locks.next();
                if (lock.context == a_context) {
                    if (a_lock_lev > 0 || lock.level > 0) {
                        block.add(lock._from);
                    }
                }
            }

            // Add new lock
            if (a_context)
                g_db.lock.save({
                    _from: a_task_id,
                    _to: id,
                    level: a_lock_lev,
                    context: a_context
                });
            else
                g_db.lock.save({
                    _from: a_task_id,
                    _to: id,
                    level: a_lock_lev
                });
        }

        owners.forEach(function(owner_id) {
            locks = g_db.lock.byExample({
                _to: owner_id
            });
            while (locks.hasNext()) {
                lock = locks.next();
                if (lock.context == a_context) {
                    if (a_owner_lock_lev > 0 || lock.level > 0) {
                        block.add(lock._from);
                    }
                }
            }

            if (a_context)
                g_db.lock.save({
                    _from: a_task_id,
                    _to: owner_id,
                    level: a_owner_lock_lev,
                    context: a_context
                });
            else
                g_db.lock.save({
                    _from: a_task_id,
                    _to: owner_id,
                    level: a_owner_lock_lev
                });
        });

        if (block.size) {
            block.forEach(function(val) {
                g_db.block.save({
                    _from: a_task_id,
                    _to: val
                });
            });

            return true;
        }
        return false;
    };


    obj._lockDepsGeneral = function(a_task_id, a_deps) {
        var i, dep, lock, locks, block = new Set();
        for (i in a_deps) {
            dep = a_deps[i];

            // Gather other tasks with priority over this new one
            locks = g_db.lock.byExample({
                _to: dep.id
            });
            while (locks.hasNext()) {
                lock = locks.next();
                if (lock.context == dep.ctx) {
                    if (dep.lev > 0 || lock.level > 0) {
                        block.add(lock._from);
                    }
                }
            }

            // Add new lock
            if (dep.ctx)
                g_db.lock.save({
                    _from: a_task_id,
                    _to: dep.id,
                    level: dep.lev,
                    context: dep.ctx
                });
            else
                g_db.lock.save({
                    _from: a_task_id,
                    _to: dep.id,
                    level: dep.lev
                });
        }

        if (block.size) {
            block.forEach(function(val) {
                g_db.block.save({
                    _from: a_task_id,
                    _to: val
                });
            });

            return true;
        }
        return false;
    };

    return obj;
}());