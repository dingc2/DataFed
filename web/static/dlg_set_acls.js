import * as model from "./model.js";
import * as api from "./api.js";
import * as dialogs from "./dialogs.js";
import * as dlgPickUser from "./dlg_pick_user.js";
import * as dlgGroups from "./dlg_groups.js";
import * as dlgGroupEdit from "./dlg_group_edit.js";


export function show( item ){
    const content =
        "<div class='col-flex' style='height:100%;width:100%;min-height:0;overflow:none'>\
            <div style='flex:none'>ID/Alias: <span id='dlg_id'></span></div>\
            <div class='row-flex' style='flex:1 1 100%;width:100%;min-height:0'>\
                <div class='col-flex' style='flex:1 1 40%;min-width:0;min-height:0;'>\
                    <div style='flex:none;padding:.5rem 0 0 0'>Permissions:</div>\
                    <div class='ui-widget-content text' style='flex:1 1 50%;min-height:0;min-width:0;width:100%;max-width:100%;overflow:auto'>\
                        <div id='dlg_rule_tree' class='no-border' style='min-height:0'></div>\
                    </div>\
                    <div style='flex:none;padding:2px 0 0 0;white-space:nowrap'>\
                        <button id='dlg_add_user' class='btn small'>Add User</button>\
                        <button id='dlg_add_group' class='btn small'>Add Group</button>\
                    </div><div style='flex:none;padding:2px 0 0 0'>\
                        <button id='dlg_edit' class='btn small'>Edit</button>\
                        <button id='dlg_rem' class='btn small'>Remove</button>\
                    </div>\
                </div>\
                <div style='flex:none'>&nbsp</div>\
                <div class='col-flex' style='flex:1 1 30%'>\
                    <div style='flex:none;padding:.5rem 0 0 0'>Local:</div>\
                    <div id='local_perm_div' class='ui-widget-content' style='flex:1 1 auto;overflow:auto;padding:.25em'>\
                    </div>\
                    <div style='flex:none;white-space:nowrap;padding:2px 0 0 0'>\
                        <button title='Set permissions to \"read only\"' id='dlg_read_only' class='btn small'>RO</button>\
                        <button title='Set permissions to \"read/write\"'id='dlg_read_write' class='btn small'>R/W</button>\
                    </div><div style='flex:none;white-space:nowrap;padding:2px 0 0 0'>\
                        <button title='Set all permissions' id='dlg_grant_all' class='btn small'>All</button>\
                        <button title='Clear all permissions' id='dlg_inherit_all' class='btn small'>Clear</button>\
                    </div>\
                </div>\
                <div id='col_div_1' style='flex:none'>&nbsp</div>\
                <div id='col_div_2' class='col-flex' style='flex:1 1 30%'>\
                    <div style='flex:none;padding:.5rem 0 0 0'>Inherited:</div>\
                    <div id='inh_perm_div' class='ui-widget-content' style='flex:1 1 auto;overflow:auto;padding:.25em'>\
                    </div>\
                    <div  style='flex:none;white-space:nowrap;padding:2px 0 0 0'>\
                        <button title='Set inherited permissions to \"read-only\"' id='dlg_inh_read_only' class='btn small'>RO</button>\
                        <button title='Set inherited permissions to \"read/write\"' id='dlg_inh_read_write' class='btn small'>R/W</button>\
                    </div><div style='flex:none;white-space:nowrap;padding:2px 0 0 0'>\
                        <button title='Set all inherited permissions' id='dlg_inh_grant_all' class='btn small'>All</button>\
                        <button title='Clear all inherited permissions' id='dlg_inh_inherit_all' class='btn small'>Clear</button>\
                    </div>\
                </div>\
            </div>\
            <!-- div style='flex:none;padding-top:.5em'><label for='public_check'></label><input type='checkbox' name='public_check' id='public_check'>&nbsp Enable public access</div -->\
        </div>";

    var frame = $(document.createElement('div'));
    frame.html( content );

    var is_root = item.id == "c/" + item.owner.charAt(0) + "_" + item.owner.substr(2) + "_root";

    function buildPermList( a_div_id, a_inh, a_mode ){
        var src = [], children;

        children = [{ title:"Read Rec.",inh:a_inh,key:model.PERM_RD_REC }];
        if ( a_mode & DATA_MODE ){
            children.push({ title:"Read Meta",inh:a_inh,key:model.PERM_RD_META });
            children.push({title:"Read Data",inh:a_inh,key:model.PERM_RD_DATA });
        }
        if ( a_mode & COLL_MODE ){
            children.push({ title:"List",inh:a_inh,key:model.PERM_LIST });
        }
        src.push({title:"Read",folder:true,key: model.PERM_BAS_READ,inh:a_inh,children:children});

        children = [{ title:"Write Rec.",inh:a_inh,key:model.PERM_WR_REC }];
        if ( a_mode & DATA_MODE ){
            children.push({ title:"Write Meta",inh:a_inh,key:model.PERM_WR_META });
            children.push({ title:"Write Data",inh:a_inh,key:model.PERM_WR_DATA });
        }
        if ( a_mode & COLL_MODE ){
            children.push({ title:"Link",inh:a_inh,key:model.PERM_LINK });
            children.push({ title:"Create",inh:a_inh,key:model.PERM_CREATE });
        }
        src.push({title:"Write",folder:true,inh:a_inh,key:model.PERM_BAS_WRITE,children:children});

        src.push({title:"Admin",folder:true,inh:a_inh,key:model.PERM_BAS_ADMIN,children:[
            { title:"Delete",inh:a_inh,key:model.PERM_DELETE },
            { title:"Share",inh:a_inh,key:model.PERM_SHARE },
            { title:"Lock",inh:a_inh,key:model.PERM_LOCK }
        ]});
    
        $(a_div_id,frame).fancytree({
            extensions: ["themeroller"],
            themeroller: {
                activeClass: "my-fancytree-active",
                addClass: "",
                focusClass: "",
                hoverClass: "my-fancytree-hover",
                selectedClass: ""
            },
            source: src,
            checkbox: true,
            selectMode: 3,
            icon:false,
            click: function( event, data ) {
                if ( data.targetType == "title" ){
                    if ( data.node.isSelected() )
                        data.node.setSelected( false );
                    else
                        data.node.setSelected( true );
                }
            },
            beforeSelect: function( event, data ) {
                if ( cur_rule ){
                    if ( !data.node.data.inh ){
                        if ( is_coll ){
                            if (( parseInt( data.node.key ) & (model.PERM_RD_REC|model.PERM_LIST) ) && data.node.isSelected() )
                                return false;
                        }else{
                            if (( parseInt( data.node.key ) & model.PERM_RD_REC ) && data.node.isSelected() )
                                return false;
                        }
                    }
                }
            },
            select: function( event, data ) {
                //console.log("selected",data.node.key,typeof data.node.key,data.node.isSelected());
                if ( !cur_rule )
                    return;
                var perm = parseInt( data.node.key );
                var other = 0;
                if ( data.node.isSelected() ){
                    other = model.PERM_RD_REC;
                    switch( perm ){
                        case model.PERM_WR_META: other |= model.PERM_RD_META; break;
                        case model.PERM_WR_DATA: other |= model.PERM_RD_DATA; break;
                        case model.PERM_LINK: other |= model.PERM_LIST; break;
                        case model.PERM_CREATE: other |= model.PERM_LIST|model.PERM_LINK; break;
                        case model.PERM_BAS_WRITE: other |= model.PERM_RD_META|model.PERM_RD_DATA|model.PERM_LIST; break;
                    }
                    if ( data.node.data.inh ){
                        cur_rule.inhgrant |= perm;
                        if ( other )
                            cur_rule.inhgrant |= other;
                    }else{
                        cur_rule.grant |= perm;
                        if ( other )
                            cur_rule.grant |= other;
                    }
                }else{
                    switch( perm ){
                        case model.PERM_RD_REC: other = model.PERM_BAS_WRITE|model.PERM_RD_META|model.PERM_RD_DATA|model.PERM_LIST|model.PERM_BAS_ADMIN; break;
                        case model.PERM_RD_META: other = model.PERM_WR_META; break;
                        case model.PERM_RD_DATA: other = model.PERM_WR_DATA; break;
                        case model.PERM_LIST: other = model.PERM_LINK|model.PERM_CREATE; break;
                        case model.PERM_LINK: other = model.PERM_CREATE; break;
                        case model.PERM_BAS_READ: other = model.PERM_WR_REC|model.PERM_WR_META|model.PERM_WR_DATA|model.PERM_LINK|model.PERM_CREATE|model.PERM_BAS_ADMIN; break;
                    }
                    if ( data.node.data.inh ){
                        cur_rule.inhgrant &= ~perm;
                        if ( other )
                            cur_rule.inhgrant &= ~other;
                    }else{
                        cur_rule.grant &= ~perm;
                        if ( other )
                            cur_rule.grant &= ~other;
                    }
                }

                if ( other ){
                    setPermsFromRule( cur_rule );
                }

                data.node.setActive(true);
            },
        });
    }

    function buildTreeSource( rules ){
        var user_rules = [];
        var group_rules = [];
        var def_rule = null;
        var sub;

        for ( var i in rules ){
            sub = rules[i];

            if ( sub.id.startsWith( "u/" ))
                user_rules.push({title:sub.id.substring(2),icon:"ui-icon ui-icon-person",key:sub.id,rule:sub });
            else if ( sub.id.startsWith( "g/" ))
                group_rules.push({title:sub.id.substring(2),icon:"ui-icon ui-icon-persons",key:sub.id,rule:sub,folder:true,lazy:true });
            else
                def_rule = sub;
        }

        var src = [
            {title:"Users",icon:"ui-icon ui-icon-folder",folder:true,expanded:true,children:user_rules,key:"users"},
            {title:"Groups",icon:"ui-icon ui-icon-folder",folder:true,expanded:true,children:group_rules,key:"groups"}
        ];

        return src;
    }


    function setAllPerm( value ){
        if ( is_coll )
            value &= ~(model.PERM_RD_META|model.PERM_WR_META|model.PERM_RD_DATA|model.PERM_WR_DATA);
        else
            value &= ~(model.PERM_CREATE|model.PERM_LINK|model.PERM_LIST);

        if ( cur_rule ){
            value |= model.PERM_RD_REC|(is_coll?model.PERM_LIST:0);
            cur_rule.grant = value;
            setPermsFromRule( cur_rule );
        }
    }

    function setAllPermInh( value ){
        if ( cur_rule ){
            cur_rule.inhgrant = value;
            setPermsFromRule( cur_rule );
        }
    }

    function setPermsFromRule( rule ){
        //console.log( "setPermsFromRule", rule );
        if ( disable_state ){
            perm_tree.enable(true);
            if ( is_coll )
                inh_perm_tree.enable(true);
            disable_state = false;
            $("#dlg_read_only",frame).button("enable");
            $("#dlg_read_write",frame).button("enable");
            $("#dlg_grant_all",frame).button("enable");
            $("#dlg_inherit_all",frame).button("enable");

            if ( is_coll ) {
                $("#dlg_inh_read_only",frame).button("enable");
                $("#dlg_inh_read_write",frame).button("enable");
                $("#dlg_inh_grant_all",frame).button("enable");
                $("#dlg_inh_inherit_all",frame).button("enable");
            }
        }

        var i,n;
        for ( i = 1; i <= model.PERM_MAX; i*=2 ){
            n = perm_tree.getNodeByKey( i.toString() );
            if ( n )
                n.setSelected( (rule.grant & i) != 0, {noEvents:true});
        }

        if ( is_coll ) {
            for ( i = 1; i <= model.PERM_MAX; i*=2 ){
                n = inh_perm_tree.getNodeByKey( i.toString() );
                if ( n )
                    n.setSelected( (rule.inhgrant & i) != 0, {noEvents:true} );
            }
        }
    }


    function disablePermControls(){
        if ( disable_state )
            return;

        var node = perm_tree.getActiveNode();
        if ( node ){
            node.setFocus(false);
            node.setActive(false);
        }
        perm_tree.enable(false);
        perm_tree.selectAll(false);

        if ( is_coll ){
            node = inh_perm_tree.getActiveNode();
            if ( node ){
                node.setFocus(false);
                node.setActive(false);
            }
            inh_perm_tree.enable(false);
            inh_perm_tree.selectAll(false);
        }

        //$(":checkbox:not(#public_check)",frame).prop("checked",false).checkboxradio("refresh").checkboxradio("disable");
        $("#dlg_read_only",frame).button("disable");
        $("#dlg_read_write",frame).button("disable");
        $("#dlg_grant_all",frame).button("disable");
        $("#dlg_inherit_all",frame).button("disable");

        if ( is_coll ) {
            //setAllPermInh(0);
            $("#dlg_inh_read_only",frame).button("disable");
            $("#dlg_inh_read_write",frame).button("disable");
            $("#dlg_inh_grant_all",frame).button("disable");
            $("#dlg_inh_inherit_all",frame).button("disable");
        }

        disable_state = true;
    }

    function updateSelection( key, rule ){
        //console.log("updateSelection",key,rule);

        cur_rule = null;
        for ( var i in new_rules ) {
            if ( new_rules[i].id == key ) {
                cur_rule = new_rules[i];
                break;
            }
        }

        if ( key.startsWith( "u/" )) {
            //disablePermControls( false );
            setPermsFromRule( rule );
            $("#dlg_edit",frame).button("disable");
            $("#dlg_rem",frame).button("enable" );
        } else if ( key.startsWith("g/")) {
            //disablePermControls(false,(key=='g/members'?true:false));
            setPermsFromRule(rule);
            $("#dlg_edit",frame).button("enable");
            $("#dlg_rem",frame).button("enable" );
        } else {
            disablePermControls();
            $("#dlg_edit",frame).button("disable");
            $("#dlg_rem",frame).button("disable");
        }
    }

    function addUser(){
        var rule, new_excl = [...excl];
        for ( var i in new_rules ){
            rule = new_rules[i];
            if ( rule.id.startsWith( "u/" ))
                new_excl.push( rule.id );
        }

        dlgPickUser.show( uid, new_excl, false, function( uids ){
            if ( uids.length > 0 ){
                var i,id,rule;
                for ( i in uids ){
                    id = uids[i];
                    if ( new_excl.indexOf( id ) == -1 && !rule_tree.getNodeByKey( id )){
                        rule = {id: id, grant: model.PERM_BAS_READ, inhgrant:0 };
                        new_rules.push( rule );
                        rule_tree.rootNode.children[0].addNode({title: id.substr(2),icon:"ui-icon ui-icon-person",key:id,rule:rule });
                    }
                }
                rule_tree.activateKey( uids[0] );
            }
        });
    }

    function addGroup(){
        var rule, node, gid, i;

        var new_excl = [...excl];
        for ( i in new_rules ){
            rule = new_rules[i];
            if ( rule.id.startsWith( "g/" ))
                new_excl.push( rule.id );
        }

        dlgGroups.show( uid, new_excl, function( gids ){
            api.groupList( uid, function( ok, groups ){
                if ( ok ){
                    var group;
                    for ( i in new_rules ){
                        rule = new_rules[i];
                        node = rule_tree.getNodeByKey( rule.id );

                        if ( rule.id.startsWith( "g/" )){
                            gid = rule.id.substr(2);
                            group = groups.find( function(elem){ return elem.gid == gid; } );
                            if ( group ){
                                node.resetLazy();
                                node.setTitle( group.title + " (" + gid + ")");
                            }else{
                                new_rules.splice(i,1);
                                node.remove();
                            }
                        }
                    }
                }

                if ( gids && gids.length > 0 ){
                    node = rule_tree.getNodeByKey("groups");

                    for ( i in gids ){
                        gid = gids[i];
                        if ( !rule_tree.getNodeByKey( gid )){
                            rule = {id: gid, grant: model.PERM_BAS_READ, inhgrant:0 };
                            new_rules.push( rule );
                            if ( ok ){
                                gid = gid.substr(2);
                                group = groups.find( function(elem){ return elem.gid == gid; } );
                                rule_tree.rootNode.children[1].addNode({title:group.title + " (" + gid + ")",icon:"ui-icon ui-icon-persons",key:"g/"+gid,rule:rule,folder:true,lazy:true });
                            }else
                                rule_tree.rootNode.children[1].addNode({title:gid.substr(2),icon:"ui-icon ui-icon-persons",key:gid,rule:rule,folder:true,lazy:true });
                        }
                    }

                    rule_tree.activateKey( gids[0] );
                }
            });
        }, true );
    }

    function editGroup(){
        var node = rule_tree.getActiveNode();
        if ( node ){
            api.groupView( uid, node.key, function( ok, group ){
                if ( ok ){
                    dlgGroupEdit.show( uid, excl, group, function( group_new ){
                        if ( group_new ){
                            node.setTitle( group_new.title + " (" +group_new.gid + ")");
                            node.resetLazy();
                        }
                    });
                }
            });
        }
    }

    function remUserGroup(){
        if ( cur_rule ){
            var key = cur_rule.id;

            if ( key == "g/members" && is_root ){
                dialogs.dlgAlert("Sharing Error", "'members' group cannot be removed from project root collection.");
                return;
            }

            var node = rule_tree.getActiveNode();
            if ( node.key == key ){
                for ( var i in new_rules ) {
                    if ( new_rules[i].id == key ){
                        new_rules.splice( i, 1 );
                        break;
                    }
                }
                cur_rule = null;
                disablePermControls( true );
                node.remove();
            }
        }
    }

    //console.log( "acls for", item );

    var DATA_MODE = 1;
    var COLL_MODE = 2;
    var is_coll = (item.id[0]=="c");
    var uid = item.owner;
    var disable_state = false;
    var orig_rules = [];
    var new_rules = [];
    var cur_rule;
    var excl = [];
    var rule_tree, perm_tree, inh_perm_tree;

    if ( item.owner.startsWith("p/")){
        api.viewProj( uid, function(proj){
            if (!proj){
                dialogs.dlgAlert("Access Error","Unable to read project data");
                frame.dialog('close');
                return;
            }
            excl = [proj.owner];
            if ( proj.admin )
                excl = excl.concat( proj.admin );
        });
    }else{
        excl = [uid];
    }

    buildPermList( '#local_perm_div', false, is_coll?COLL_MODE:DATA_MODE );
    perm_tree = $.ui.fancytree.getTree($("#local_perm_div",frame));

    if ( is_coll ){
        buildPermList( '#inh_perm_div', true, COLL_MODE|DATA_MODE );
        inh_perm_tree = $.ui.fancytree.getTree($("#inh_perm_div",frame));
    }


    if ( is_coll ){
        $("#dlg_inh_read_only",frame).click( function(){ setAllPermInh(model.PERM_BAS_READ); });
        $("#dlg_inh_read_write",frame).click( function(){ setAllPermInh(model.PERM_BAS_READ|model.PERM_BAS_WRITE); });
        $("#dlg_inh_grant_all",frame).click( function(){ setAllPermInh(model.PERM_ALL); });
        $("#dlg_inh_inherit_all",frame).click( function(){ setAllPermInh(0); });
    }else{
        $("#col_div_1",frame).hide();
        $("#col_div_2",frame).hide();
    }

    $("#dlg_read_only",frame).click( function(){ setAllPerm(model.PERM_BAS_READ); });
    $("#dlg_read_write",frame).click( function(){ setAllPerm(model.PERM_BAS_READ|model.PERM_BAS_WRITE); });
    $("#dlg_grant_all",frame).click( function(){ setAllPerm(model.PERM_ALL); });
    $("#dlg_inherit_all",frame).click( function(){ setAllPerm(0); });
    $("#dlg_add_user",frame).click( function(){ addUser(); });
    $("#dlg_add_group",frame).click( function(){ addGroup(); });
    $("#dlg_rem",frame).click( function(){ remUserGroup(); });
    $("#dlg_edit",frame).click( function(){ editGroup(); });

    api.aclView( item.id, function( ok, data ){
        if ( !ok || !data ) {
            dialogs.dlgAlert( "Sharing Error", data );
            return;
        }
        //console.log("data",data);

        if ( !data.rule )
            data.rule = [];

        if ( data.rule ) {
            orig_rules = data.rule.slice();
            new_rules = data.rule;
        } else {
            orig_rules = [];
            new_rules = [];
        }

        var options = {
            title: "Sharing for " + (is_coll?"Collection \"":"Data \"") + item.title + "\"",
            modal: true,
            width: is_coll?600:500,
            height: 450,
            resizable: true,
            buttons: [{
                text: "Cancel",
                click: function() {
                    $(this).dialog('close');
                }
            },{
                text: "Ok",
                click: function() {
                    var x = $(this);

                    //var is_public = $("#public_check",frame).prop("checked");
                    //console.log( "SAVE ACLS:", is_public, new_rules );

                    api.aclUpdate( item.id, new_rules, function( ok, data ){
                        if ( !ok )
                            dialogs.dlgAlert( "Sharing Update Failed", data );
                        else
                            x.dialog('close');
                    });
                }
            }],
            open: function(event,ui){
                $("#dlg_id",frame).html((item.alias?"("+item.alias+")":"["+item.id.substr(2)+"]") );

                if ( item.ispublic ){
                    var widget = frame.dialog( "widget" );
                    $(".ui-dialog-buttonpane",widget).append("<span class='note' style='padding:1em;line-height:200%'>Note: public read access active.</span>");
                }

                var src = buildTreeSource( orig_rules );

                $("#dlg_rule_tree",frame).fancytree({
                    extensions: ["themeroller"],
                    themeroller: {
                        activeClass: "my-fancytree-active",
                        addClass: "",
                        focusClass: "",
                        hoverClass: "my-fancytree-hover",
                        selectedClass: ""
                    },
                    source: src,
                    selectMode: 1,
                    nodata: false,
                    lazyLoad: function( event, data ) {
                        if ( data.node.key.startsWith("g/")){
                            data.result = {
                                url: "/api/grp/view?uid="+encodeURIComponent(uid)+"&gid="+encodeURIComponent(data.node.key.substr(2)),
                                cache: false
                            };
                        }
                    },
                    postProcess: function( event, data ) {
                        console.log("post proc",data);
                        if ( data.node.key.startsWith("g/")){
                            data.node.setTitle( data.response.title + " (" +data.response.gid + ")" );
                            data.result = [];
                            if ( data.response.desc )
                                data.result.push({title: "["+data.response.desc+"]", icon: false });

                            if ( data.response.member && data.response.member.length ){
                                for ( var i in data.response.member ) {
                                    data.result.push({ title: data.response.member[i].substr(2), icon:"ui-icon ui-icon-person" });
                                }
                            }else{
                                data.result.push({ title: "(empty)", icon: false  });
                            }
                        }
                    },
                    activate: function( event, data ) {
                        updateSelection( data.node.key, data.node.data.rule );
                    },
                });

                rule_tree = $.ui.fancytree.getTree($("#dlg_rule_tree",frame));
            },
            close: function( ev, ui ) {
                $(this).dialog("destroy").remove();
            }
        };

        frame.dialog( options );
        $(".btn",frame).button();
        $(":checkbox",frame).checkboxradio();
        //$("#public_check",frame).checkboxradio();
        //$("#public_check",frame).prop("checked",item.ispublic);
        //$("#public_check",frame).checkboxradio("refresh");

        disablePermControls( true );
        $("#dlg_edit",frame).button("disable");
        $("#dlg_rem",frame).button("disable");

        // Switch dialog to fixed-hieght mode
        var height = frame.parent().height();
        frame.dialog( "option", "height", height + 10 );
    });
}

