/*jshint strict: global */
/*jshint esversion: 6 */
/*jshint multistr: true */
/* globals require */
/* globals module */
/* globals console */

'use strict';

const   createRouter = require('@arangodb/foxx/router');
const   router = createRouter();
const   joi = require('joi');

const   g_db = require('@arangodb').db;
const   g_graph = require('@arangodb/general-graph')._graph('sdmsg');
const   g_lib = require('./support');

module.exports = router;

//==================== DATA API FUNCTIONS


router.get('/create', function (req, res) {
    try {
        var result = [];

        g_db._executeTransaction({
            collections: {
                read: ["u","uuid","accn"],
                write: ["d","a","owner","alias"]
            },
            action: function() {
                const client = g_lib.getUserFromClientID( req.queryParams.client );

                var obj = { data_size: 0, rec_time: Math.floor( Date.now()/1000 ) };

                if ( req.queryParams.title )
                    obj.title = req.queryParams.title;

                if ( req.queryParams.desc )
                    obj.desc = req.queryParams.desc;

                if ( req.queryParams.md )
                    obj.md = JSON.parse( req.queryParams.md );

                var data = g_db.d.save( obj, { returnNew: true });
                g_db.owner.save({ _from: data._id, _to: client._id });

                if ( req.queryParams.alias ) {
                    g_lib.validateAlias( req.queryParams.alias );
                    var alias_key = client._key + ":" + req.queryParams.alias;

                    g_db.a.save({ _key: alias_key });
                    g_db.alias.save({ _from: data._id, _to: "a/" + alias_key });
                    g_db.owner.save({ _from: "a/" + alias_key, _to: client._id });
                    data.new.alias = req.queryParams.alias;
                }

                delete data.new._rev;
                delete data.new._key;
                data.new.id = data.new._id;
                delete data.new._id;

                result.push( data.new );
            }
        });

        res.send( result );
    } catch( e ) {
        g_lib.handleException( e, res );
    }
})
.queryParam('client', joi.string().required(), "Client ID")
.queryParam('title', joi.string().optional(), "Title")
.queryParam('desc', joi.string().optional(), "Description")
.queryParam('alias', joi.string().optional(), "Alias")
.queryParam('proj', joi.string().optional(), "Optional project owner id")
.queryParam('coll', joi.string().optional(), "Optional collection id or alias")
.queryParam('md', joi.string().optional(), "Metadata (JSON)")
.summary('Creates a new data record')
.description('Creates a new data record');


router.get('/update', function (req, res) {
    try {
        var result = [];

        g_db._executeTransaction({
            collections: {
                read: ["u","uuid","accn"],
                write: ["d","a","owner","alias"]
            },
            action: function() {
                var data;
                const client = g_lib.getUserFromClientID( req.queryParams.client );
                var data_id = g_lib.resolveID( req.queryParams.id, client );
                if ( !g_lib.hasAdminPermObject( client, data_id )) {
                    data = g_db.d.document( data_id );
                    if ( !g_lib.hasPermission( client, data, g_lib.PERM_UPDATE ))
                        throw g_lib.ERR_PERM_DENIED;
                }

                if ( req.queryParams.alias )
                    g_lib.validateAlias( req.queryParams.alias );

                var obj = { rec_time: Math.floor( Date.now()/1000 ) };
                var do_update = false;

                if ( req.queryParams.title != undefined ) {
                    obj.title = req.queryParams.title;
                    do_update = true;
                }

                if ( req.queryParams.desc != undefined ) {
                    obj.desc = req.queryParams.desc;
                    do_update = true;
                }

                if ( req.queryParams.md != undefined ) {
                    obj.md = JSON.parse( req.queryParams.md );
                    do_update = true;
                }

                if ( req.queryParams.data_size != undefined ) {
                    obj.data_size = req.queryParams.data_size;
                    do_update = true;
                }

                if ( req.queryParams.data_time != undefined ) {
                    obj.data_time = req.queryParams.data_time;
                    do_update = true;
                }

                if ( do_update ) {
                    data = g_db._update( data_id, obj, { keepNull: false, returnNew: true, mergeObjects: req.queryParams.md_merge });
                    data = data.new;
                } else {
                    data = g_db.d.document( data_id );
                }

                if ( req.queryParams.alias ) {
                    var old_alias = g_db.alias.firstExample({ _from: data_id });
                    if ( old_alias ) {
                        g_db.a.remove( old_alias._to );
                        g_db.alias.remove( old_alias );
                    }

                    var owner_id = g_db.owner.firstExample({ _from: data_id })._to;
                    var alias_key = owner_id.substr(2) + ":" + req.queryParams.alias;

                    g_db.a.save({ _key: alias_key });
                    g_db.alias.save({ _from: data_id, _to: "a/" + alias_key });
                    g_db.owner.save({ _from: "a/" + alias_key, _to: owner_id });
                    data.alias = req.queryParams.alias;
                }

                delete data._rev;
                delete data._key;
                data.id = data._id;
                delete data._id;

                result.push( data );
            }
        });

        res.send( result );
    } catch( e ) {
        g_lib.handleException( e, res );
    }
})
.queryParam('client', joi.string().required(), "Client ID")
.queryParam('id', joi.string().required(), "Data record ID or alias")
.queryParam('title', joi.string().optional(), "Title")
.queryParam('desc', joi.string().optional(), "Description")
.queryParam('alias', joi.string().optional(), "Alias")
.queryParam('proj', joi.string().optional(), "Project owner id")
.queryParam('md', joi.string().optional(), "Metadata (JSON)")
.queryParam('md_merge', joi.boolean().optional().default(true), "Merge metadata instead of replace (merge is default)")
.queryParam('data_size', joi.number().optional(), "Data size (bytes)")
.queryParam('data_time', joi.number().optional(), "Data modification time")
.summary('Updates an existing data record')
.description('Updates an existing data record');


router.get('/view', function (req, res) {
    try {
        const client = g_lib.getUserFromClientID( req.queryParams.client );

        var data_id = g_lib.resolveID( req.queryParams.id, client );
        var data = g_db.d.document( data_id );

        if ( !g_lib.hasAdminPermObject( client, data_id )) {
            if ( !g_lib.hasPermission( client, data, g_lib.PERM_VIEW ))
                throw g_lib.ERR_PERM_DENIED;
        }

        var owner_id = g_db.owner.firstExample({ _from: data_id })._to;

        var alias = g_db._query("for v in 1..1 outbound @data alias return v", { data: data_id }).toArray();
        if ( alias.length ) {
            data.alias = alias[0]._key.substr( owner_id.length - 1 );
        }

        data.owner = owner_id.substr(2);
        delete data._rev;
        delete data._key;
        data.id = data._id;
        delete data._id;

        res.send( [data] );
    } catch( e ) {
        g_lib.handleException( e, res );
    }
})
.queryParam('client', joi.string().required(), "Client ID")
.queryParam('id', joi.string().required(), "Data ID or alias")
.summary('Get data by ID or alias')
.description('Get data by ID or alias');


router.get('/list', function (req, res) {
    try {
        const client = g_lib.getUserFromClientID( req.queryParams.client );
        var owner_id;

        if ( req.queryParams.subject ) {
            owner_id = "u/" + req.queryParams.subject;
            g_lib.ensureAdminPermUser( client, owner_id );
        } else {
            owner_id = client._id;
        }

        const result = g_db._query( "for v in 1..1 inbound @owner owner filter IS_SAME_COLLECTION('d', v) let a = (for i in outbound v._id alias return i._id) return { id: v._id, title: v.title, alias: a[0] }", { owner: owner_id }).toArray();

        //const result = g_db._query( "for v in 1..1 inbound @owner owner filter IS_SAME_COLLECTION('d', v) return { id: v._id, title: v.title }", { owner: owner_id }).toArray();

        res.send( result );
    } catch( e ) {
        g_lib.handleException( e, res );
    }
})
.queryParam('client', joi.string().required(), "Client ID")
.queryParam('subject', joi.string().optional(), "UID of subject user (optional)")
.summary('List all data owned by client, or subject')
.description('List all data owned by client, or subject');

// TODO Add limit, offset, and details options
// TODO Add options for ALL, user/project, or collection (recursize or not) options
router.get('/find', function (req, res) {
    try {
        const client = g_lib.getUserFromClientID( req.queryParams.client );

        //console.log( 'query: ', "for i in d filter " + req.queryParams.query + " return i" );
        const cursor = g_db._query( "for i in d filter " + req.queryParams.query + " return i" );
        //console.log( 'items: ', items );

        var result = [];
        var item;

        while ( cursor.hasNext() ) {
            item = cursor.next();
            if ( g_lib.hasAdminPermObject( client, item._id ) || g_lib.hasPermission( client, item, g_lib.PERM_LIST )) {
                result.push({ id: item._id, title: item.title, desc: item.desc, md: item.md });
            }
        }

        res.send( result );
    } catch( e ) {
        g_lib.handleException( e, res );
    }
})
.queryParam('client', joi.string().required(), "Client ID")
.queryParam('query', joi.string().required(), "Query expression")
.summary('Find all data records that match query')
.description('Find all data records that match query');


router.get('/delete', function (req, res) {
    try {
        g_db._executeTransaction({
            collections: {
                read: ["u","uuid","accn","d"],
                write: ["d","a","n","owner","item","acl","tag","note","alias"]
            },
            action: function() {
                const client = g_lib.getUserFromClientID( req.queryParams.client );

                var data_id = g_lib.resolveID( req.queryParams.id, client );
                g_lib.ensureAdminPermObject( client, data_id );

                var data = g_db.d.document( data_id );
                var obj;

                const graph = require('@arangodb/general-graph')._graph('sdmsg');

                // Delete attached notes and aliases
                var objects = g_db._query( "for v in 1..1 outbound @data note, alias return v._id", { data: data._id }).toArray();
                for ( var i in objects ) {
                    obj = objects[i];
                    graph[obj[0]].remove( obj );
                }

                graph.d.remove( data._id );
            }
        });
    } catch( e ) {
        g_lib.handleException( e, res );
    }
})
.queryParam('client', joi.string().required(), "Client ID")
.queryParam('id', joi.string().required(), "Data ID or alias")
.summary('Deletes an existing data record')
.description('Deletes an existing data record');


