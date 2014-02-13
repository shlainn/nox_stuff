$(document).ready(function()
{
    $("#mapTabs ul").idTabs();
    
    $("#canvasMapArea").click(function(event) { canvasmap_click(event); });
    $("#canvasMapArea").mousemove(function(event) { canvasmap_move(event); });
    $("#canvasMapArea").mouseover(function() { canvasmap_tooltip_start(); });
    $("#canvasMapArea").mouseout(function() { canvasmap_tooltip_stop(); canvasmap_drag_stop();});
    $("#canvasMapArea").mousedown(function(event) {canvasmap_drag_start(event);});
    $("#canvasMapArea").mouseup(function() {canvasmap_drag_stop();});
    
    $("#resetView").click(function() { reset_view(); });
    $("#zoomIn").click(function() { zoom(current.range>200 ? -200 : -current.range / 2); });
    $("#zoomOut").click(function() { zoom(current.range>200 ? 200 : current.range); });
    $("#rotateLeft").click(function() { rotate(-60); });
    $("#rotateRight").click(function() { rotate(60); });

    $("#moveLeft").click(function() { move(-current.range/2,0,0); });
    $("#moveRight").click(function() { move(current.range/2,0,0); });
    $("#moveForward").click(function() { move(0,0,-current.range/2); });
    $("#moveBack").click(function() { move(0,0,current.range/2); });
    
    $("#fleetScan").click(function() { fleet_scan(); });
    
    $("#toggleLines").click(function() {
        draw_config.S.baseline_always = !draw_config.S.baseline_always;
        draw_config.S.baseline_close = !draw_config.S.baseline_close;
        draw_config.P.baseline_close = !draw_config.P.baseline_close;
        draw();
    });

    var translate = {};
    translate.sendText = $("#sendText").text();
    translate.no_part_selected = $("#noPartSelected").text();
    translate.activate_scan_to_see_fleets = "Flottenscan starten um Flotten anzuzeigen";

    
    var scan_animation_start, scan_animation_start2, scan_animation_step, scan_animation_stop = false;
    var animation_progress_previous = 0;
    var show_fleet_overlay = false;
    var list_all_my_fleets = false;
    var list_all_foreign_fleets = false;

    var drawlist =[], spaceParts = {}, fleets = {}, fleet_sectors, fleet_index, selected_object = null;
    var animation_start;
    var animation_running;
    var animation_blocked=false;
    var animation_duration = 1000, scan_animation_duration = 1500;
    var canvas = {"width" : 630, "height": 500, "padding": 10};
    var draw_config = {
//       "S" : {"baseline_always": true, "baseline_close": true, "baseline_color": "#050", "label": "sName", "size_min": 8, "size_max": 25},
//       "H" : {"baseline_always": false, "baseline_close": false, "baseline_color": "#003", "label": false, "size_min": 5, "size_max": 10},
//       "P" : {"baseline_always": false, "baseline_close": true, "baseline_color": "#020", "label": false, "size_min": 4, "size_max": 12},
//       "F" : {"baseline_always": false, "baseline_close": false, "baseline_color": "#020", "label": false, "size_min": 4, "size_max": 6}
      "S" : {"baseline_always": true, "baseline_close": true, "baseline_color": "#050", "label": "sName", "size_min": 8, "size_max": 50},
      "H" : {"baseline_always": false, "baseline_close": false, "baseline_color": "#003", "label": false, "size_min": 5, "size_max": 20},
      "P" : {"baseline_always": false, "baseline_close": true, "baseline_color": "#020", "label": false, "size_min": 4, "size_max": 25},
      "F" : {"baseline_always": false, "baseline_close": false, "baseline_color": "#020", "label": false, "size_min": 4, "size_max": 6}
    };
    
    var draw_flags = {
      "isOwner" : 0x1,
      "isUnion" : 0x2,
    };
    
    var fleet_index_offset = 1000000;
    
    var fleet_draw_config = {
      "myFleets" : {"subType":3},
      "unionFleets" : {"subType":1},
      "alienFleets" : {"subType":2,"gradient_start1": "rgba(0,", "gradient_factor": 180, "gradient_start2":",180,0.7)"},
      "foreignFleets":{"subType":4,"gradient_start1": "rgba(180,", "gradient_factor": 180, "gradient_start2":",0,0.7)"},
    };
    
    // Space Part type map onto spritesheet
    // Index number of first sprite of a type
    var types = { "Desert" : 0, "Extentium" : 5, "Fireball" : 10, "Jungle" : 15, "Stone" : 20, "Water" : 25,
        "OrangeDwarf" : 30, "RedDwarf" : 31, "YellowDwarf" : 32, "Homebase": 33, "Fleet": 34,
    };

    var planetId = parseInt($("#planetId").text()) || 0;
    var homebaseId = parseInt($("#homebaseId").text()) || 0;
    var fleetId = parseInt($("#fleetId").text()) || 0;
    var viewPosX = parseInt($("#viewPosX").text());
    var viewPosY = parseInt($("#viewPosY").text());
    var viewPosZ = parseInt($("#viewPosZ").text());
    var viewRange = parseInt($("#viewRangeOfSight").text());
    var start = {x:0, y: 0, z: 0, range: 0, angle: 0};//for animating.
    var target = {x: viewPosX,y: viewPosY,z: viewPosZ, range: viewRange, angle: 0};
    var current = {x: viewPosX,y: viewPosY,z: viewPosZ, range: 2000, angle: 180};

    var spritesheet = new Image();
    spritesheet.onload = function(){getSpaceParts(fleetId, homebaseId, planetId);};
    spritesheet.src = $("#planetSrc").text();
    
    var c=$("#canvasMapArea")[0];
    var ctx=c.getContext("2d");
    var cc=$("#canvasMapArea_click")[0];
    var click_ctx=cc.getContext("2d");

    function init()
    {
        reset_view();
    }
    
    function getSpaceParts(fleetId, homebaseId, planetId)
    {
        $.ajax(
        {
            type: "POST",
            url: "mil_canvasMap_getAllSpaceParts.php",
            data: "fleetId=" + fleetId + "&homebaseId=" + homebaseId + "&planetId=" + planetId,
            async: false,
            success: function(dataArray)
            {
                if (dataArray.length > 0)
                {
                    var result = jQuery.parseJSON(dataArray);
                    for(var i = 0; i < result.length; i += 1) {
                      var partId = parseInt(result[i].partId);
                      spaceParts[partId] = result[i];
                      var d = {};
                      d.partId = partId;
                      d.spacePart = result[i].spacePart;
                      d.x = parseInt(result[i].x);
                      d.y = parseInt(result[i].y);
                      d.z = parseInt(result[i].z);
                      d.idx = types[result[i].type]+parseInt(result[i].subType)-1;
                      d.flags = (result[i].isOwner == 1 ? draw_flags.isOwner : 0) | 
                                (result[i].inUnion == 1 ? draw_flags.isUnion : 0);
                      drawlist.push(d);
                    }
                }
                init();
            },
            error: function()
            {
                alert("FRELL");
            }
        });
    }
    
    function getHeatmap(fleetId, homebaseId, planetId)
    {
        $.ajax(
        {
            type: "POST",
            url: "mil_canvasMap_getHeatmap.php",
            data: "fleetId=" + fleetId + "&homebaseId=" + homebaseId + "&planetId=" + planetId,
            async: true,
            success: function(dataArray)
            {
                if (dataArray.length > 0)
                {
                    fleet_sectors = jQuery.parseJSON(dataArray);
                }
                scan_animation_stop = 1;
                draw();
              
            },
            error: function()
            {
                alert("FRELL");
            }
        });
    }

    function getVisibleFleets(fleetId, homebaseId, planetId, x, y, z, rangeOfSight)
    {
        $.ajax(
        {
            type: "POST",
            url: "mil_canvasMap_getVisibleFleets.php",
            data: "fleetId=" + fleetId + "&homebaseId=" + homebaseId + "&planetId=" + planetId + "&x=" + x + "&y=" + y + "&z=" + z + "&mapRangeOfSight=" + rangeOfSight,
            async: true,
            success: function(dataArray)
            {
                if (dataArray.length > 0)
                {
                    var result = jQuery.parseJSON(dataArray);
                    for(var fleetType in result) {
                      for(var i = 0; i < result[fleetType].length; i += 1) {
                        var partId = parseInt(result[fleetType][i].id) || fleet_index_offset+parseInt(result[fleetType][i].planetId);
                        partId += fleet_index_offset;//offset all fleets vs planets by 1M
                        var d = {};
                        d.partId = partId;
                        d.spacePart = "F";
                        d.x = parseInt(result[fleetType][i].x);
                        d.y = parseInt(result[fleetType][i].y);
                        d.z = parseInt(result[fleetType][i].z);
                        d.dX = parseInt(result[fleetType][i].dX);
                        d.dY = parseInt(result[fleetType][i].dY);
                        d.dZ = parseInt(result[fleetType][i].dZ);
                        d.idx = types.Fleet+fleet_draw_config[fleetType].subType-1;
                        d.flags = 0;
                        if(fleets[partId] === undefined) {
                          drawlist.push(d);
                        } else {
                          for( var j = 0; j < drawlist.length; j += 1) {
                            if(drawlist[i].partId == partId) {
                              drawlist[i] = d;
                            }
                          }
                        }
                        
                        fleets[partId] = result[fleetType][i];
                        fleets[partId].fleetType = fleetType;
                      }
                    }
                }
                scan_animation_stop = 1;
                draw();
                update_fleet_list();
            },
            error: function()
            {
                alert("FRELL");
                scan_animation_stop = -1;
            }
        });
    }
    
    // requestAnim shim layer by Erik Möller
    // thanks to http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelRequestAnimationFrame = window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
    }

    var map_drag = false, map_drag_prevent_click = false, map_was_dragged = false;
    var map_drag_position;
    function canvasmap_drag_start(e) {
      map_drag = true;
      map_was_dragged = false;
      setTimeout(function(){map_drag_prevent_click = true;},200);
      if (!e)
        e = window.event;
      var parentOffset = $("#canvasMapArea").offset();
      map_drag_position = {
        offsetX : Math.floor(e.pageX - parentOffset.left),
        offsetY : Math.floor(e.pageY - parentOffset.top)
      };
    }

    function canvasmap_drag_stop() {
      map_drag = false;
      setTimeout(function(){map_drag_prevent_click = false;},200);
      if(show_fleet_overlay && map_was_dragged) {
        fleet_scan_request_start();
      }      
    }

    var tooltip_active=false;

    function canvasmap_tooltip_start() {
      tooltip_active = true;
    }

    function canvasmap_tooltip_stop() {
      tooltip_active = false;
    }

    function calc_dist(source, target) {
      return Math.sqrt(Math.pow(source.x - target.x , 2) + Math.pow(source.y - target.y , 2) + Math.pow(source.z - target.z , 2)).toFixed(3);
    }

    function canvasmap_move(e)
    {
      if(!tooltip_active && !map_drag)
        return;

      if (!e)
        e = window.event;
      var parentOffset = $("#canvasMapArea").offset();
      var offsetX = Math.floor(e.pageX - parentOffset.left);
      var offsetY = Math.floor(e.pageY - parentOffset.top);

      var scale = current.range*2;

      var min = {
          x : current.x - current.range,
          y : current.y - current.range,
          z : current.z - current.range
      };
      var angle = (current.angle % 360) / 180 * Math.PI;

      //drag
      if(map_drag) {
        map_was_dragged = true;
        var deltaX = offsetX - map_drag_position.offsetX;
        var deltaY = (map_drag_position.offsetY - offsetY)*2;
        var deltaX2 = deltaY * Math.sin(angle) - deltaX * Math.cos(angle);
        var deltaY2 = deltaX * Math.sin(angle) + deltaY * Math.cos(angle);
        current.x += (deltaX2/canvas.width ) * scale;
        current.z += (deltaY2/canvas.height ) * scale;
        target.x = current.x;
        target.z = current.z;
        draw();
        map_drag_position.offsetX = offsetX;
        map_drag_position.offsetY = offsetY;
        $("#canvasTooltip").css("display", "none");
        return;
      }
      //Tooltip

      var click_data = click_ctx.getImageData(offsetX,offsetY,1, 1);
      var object_id =(click_data.data[0] << 16) | (click_data.data[1] << 8) | click_data.data[2];
      var tooltip = $("#canvasTooltip");
      if(object_id === 0)
      {
        tooltip.css("display", "none");
        return;
      }

      if(object_id > 0 && object_id < fleet_index_offset)
      {
        var distance = calc_dist({x:viewPosX, y:viewPosY, z:viewPosZ},{x:spaceParts[object_id].x, y:spaceParts[object_id].y, z:spaceParts[object_id].z});
        var dist_current = calc_dist(current,{x:spaceParts[object_id].x, y:spaceParts[object_id].y, z:spaceParts[object_id].z});
        var tipText = spaceParts[object_id].label+"<br />"+spaceParts[object_id].posLabel+"<br />"+"Distance: "+distance+" pc<br />To current:"+dist_current+"<br />";
        tooltip.html(tipText);
      }
      if(object_id > fleet_index_offset)
      {
        var index = fleet_index[object_id-fleet_index_offset];
        var tooltip_html = [];
        var this_fleet;
        for(var i = 0; i < index.length; i += 1) {
          this_fleet = fleets[index[i]];          
          tooltip_html.push(this_fleet.name+"<br>"+this_fleet.state+" / "+this_fleet.mission+"<br>("+this_fleet.x+"/"+this_fleet.y+"/"+this_fleet.z+")");
        }
        tooltip.html(tooltip_html.join("<hr>"));
      }
      var temp = object_id < fleet_index_offset ? rotate_around_current(spaceParts[object_id]) : rotate_around_current(fleets[fleet_index[object_id-fleet_index_offset][0]]);

      var screen_x = canvas.padding+(temp.rot_x-min.x)*((canvas.width-2*canvas.padding)/scale);
      var screen_y = (canvas.height * 0.5)+(temp.rot_z-min.z)*((canvas.height * 0.5 - canvas.padding)/scale);
      var y_offset = (temp.rot_y-min.y)*((canvas.height)/scale) - canvas.height * 0.25;
      tooltip.css("display", "block");
      tooltip.offset({"top": parseInt(parentOffset.top+screen_y-y_offset)+3,"left": parseInt(parentOffset.left)+screen_x+15});
    }
    
    
    
    function canvasmap_click(e)
    {
      if(map_drag_prevent_click)
        return;
      if (!e)
        e = window.event;

      var parentOffset = $("#canvasMapArea").offset();
      var offsetX = Math.floor(e.pageX - parentOffset.left);
      var offsetY = Math.floor(e.pageY - parentOffset.top);

      var click_data = click_ctx.getImageData(offsetX,offsetY,1, 1);
      var object_id =(click_data.data[0] << 16) | (click_data.data[1] << 8) | click_data.data[2];

      if(object_id === 0){
        update_selection(null);
        return;
      }
      if(object_id > 0 && object_id < fleet_index_offset ) {
        target.x = parseInt(spaceParts[object_id].x);
        target.y = parseInt(spaceParts[object_id].y);
        target.z = parseInt(spaceParts[object_id].z);
        update_selection(object_id);
      }
      if(object_id >= fleet_index_offset) {
        var index = fleet_index[object_id-fleet_index_offset];
        var this_fleet = fleets[index[0]];//pick first fleet from stack for zooming
        target.x = parseInt(this_fleet.x);
        target.y = parseInt(this_fleet.y);
        target.z = parseInt(this_fleet.z);
        update_selection(object_id);
      }
      
      //Zoom on target
      target.range = current.range > 200 ? 200 : (current.range > 100 ? 100 : current.range);
      $("#canvasTooltip").css("display", "none");
      animate_transition_start();
    }
    
    function update_selection(new_select) {
      if(new_select === null) {
        selected_object = null;
        $("#canvasMapItemInfo").html(translate.no_part_selected);
      } else if (new_select > 0 && new_select < fleet_index_offset) {
        selected_object = new_select;
        var planet_id = new_select;
        var tipText = spaceParts[planet_id].label+"<br />"+spaceParts[planet_id].posLabel+"<br />";
        if(fleetId !== 0) {// only if this map is for a fleet
          var sendId = spaceParts[planet_id].partId;
          switch(spaceParts[planet_id].spacePart)
          {
              case "P":
                  tipText += "<a class='helpIndexLink' href='mil_sendFleetToPlanet.php?id="+sendId+"'>";
                  break;
              case "H":
                  tipText += "<a class='helpIndexLink' href='mil_sendFleetToHomebase.php?id="+sendId+"'>";
                  break;
              case "S":
                  tipText += "<a class='helpIndexLink' href='mil_sendFleetToStar.php?id="+sendId+"'>";
                  break;
          }
          tipText += translate.sendText+"</a>";
        }
        $("#canvasMapItemInfo").html(tipText);        
      } else if (new_select >= fleet_index_offset) {
        selected_object = null;
        var index = fleet_index[new_select-fleet_index_offset];

        var iteminfohtml = [];
        var this_fleet;
        for(var i = 0; i < index.length; i += 1) {
          if(selected_object === null) {
            selected_object = index[i];
          }
          this_fleet = fleets[index[i]];          
          iteminfohtml.push(this_fleet.name+"<br>"+this_fleet.state+"/"+this_fleet.mission+"<br>("+this_fleet.x+"/"+this_fleet.y+"/"+this_fleet.z+")");
        }        
        $("#canvasMapItemInfo").html(iteminfohtml.join("<hr>"));
      }       
      draw();
    }

    
    function rotate_around_current(vector)
    {
        //rotate around Y
        var angle = (current.angle % 360) / 180 * Math.PI;
        var x = vector.x-current.x;
        var z = vector.z-current.z;
        var xnew = x * Math.cos(angle) - z * Math.sin(angle);
        var znew = z * Math.cos(angle) + x * Math.sin(angle);
        vector.rot_x = xnew + current.x;
        vector.rot_y = vector.y;
        vector.rot_z = znew + current.z;
        return vector;
    }

    function draw_grid()
    {
      var i;
      ctx.lineWidth =0.5;
      var scale = current.range*2;

      var min = {
          x : current.x - current.range,
          z : current.z - current.range
      };

      var gridsize = 25 * 1 << Math.floor((scale) / 400);
      var gridbase_x = Math.floor(current.x/gridsize)*gridsize;
      var gridbase_z = Math.floor(current.z/gridsize)*gridsize;
      var num_grid = Math.ceil(current.range/gridsize)+1;
      ctx.strokeStyle="#00d";

      ctx.beginPath();
      var v, screen_x, screen_y;
      for(i=-num_grid; i <= num_grid; i += 1) {
        //horizontal line
        v = rotate_around_current({x: gridbase_x+gridsize*i, z: gridbase_z-num_grid*gridsize});
        screen_x = canvas.padding+(v.rot_x-min.x)*((canvas.width-2*canvas.padding)/scale);
        screen_y = (canvas.height * 0.5)+(v.rot_z-min.z)*((canvas.height * 0.5 - canvas.padding)/scale);
        ctx.moveTo(screen_x, screen_y);
        v = rotate_around_current({x: gridbase_x+gridsize*i, z: gridbase_z+num_grid*gridsize});
        screen_x = canvas.padding+(v.rot_x-min.x)*((canvas.width-2*canvas.padding)/scale);
        screen_y = (canvas.height * 0.5)+(v.rot_z-min.z)*((canvas.height * 0.5 - canvas.padding)/scale);
        ctx.lineTo(screen_x, screen_y);
        //vertical line line
        v = rotate_around_current({x: gridbase_x-num_grid*gridsize, z: gridbase_z+gridsize*i});
        screen_x = canvas.padding+(v.rot_x-min.x)*((canvas.width-2*canvas.padding)/scale);
        screen_y = (canvas.height * 0.5)+(v.rot_z-min.z)*((canvas.height * 0.5 - canvas.padding)/scale);
        ctx.moveTo(screen_x, screen_y);
        v = rotate_around_current({x: gridbase_x+num_grid*gridsize, z: gridbase_z+gridsize*i});
        screen_x = canvas.padding+(v.rot_x-min.x)*((canvas.width-2*canvas.padding)/scale);
        screen_y = (canvas.height * 0.5)+(v.rot_z-min.z)*((canvas.height * 0.5 - canvas.padding)/scale);
        ctx.lineTo(screen_x, screen_y);
      }
      ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.globalCompositeOperation = "destination-atop";
      ctx.translate((canvas.width * 0.5),370);
      var grd=ctx.createRadialGradient(0,0,0,0,0,305);
      grd.addColorStop(0,"#005");
      grd.addColorStop(0.85,"#003");
      grd.addColorStop(0.98,"rgba(0,0,0,0)"/*"#000"*/);
      ctx.fillStyle=grd;
      ctx.beginPath();
      ctx.scale(1,0.397);
      ctx.arc(0,0,305,0,2*Math.PI);
      ctx.fill();
      ctx.restore();
    }

    function pad(n, width, z)
    {
      z = z || '0';
      n = n + '';
      return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }

    function draw_space_objects()
    {
        var draw_baseline_close = current.range <= 100;
        var i, planet_id, index_number;

        var scale = current.range*2;
        var min = { x : current.x - current.range,
          y : current.y - current.range,
          z : current.z - current.range
        };
        var object_alpha_range = current.range >= 250 ? 0.8 : 0.2+0.6*((current.range-25)/225);
        var object_alpha_min = 1 - object_alpha_range;


        var textboxes = [];
        //Rotate and sort back to front
        for(i = 0; i < drawlist.length; i += 1) {
            drawlist[i] = rotate_around_current(drawlist[i]);
            if(drawlist[i].spacePart == "F") {
              drawlist[i].rot_z +=0.1; //HACK: force fleet in front of planet
            }
        }
        
        if(show_fleet_overlay && current.range <= 200) {
          fleet_index = [];
          index_number = fleet_index_offset;
        }

        drawlist.sort(function(a,b){return a.rot_z - b.rot_z;});//sort by z coordinate

        for(i = 0; i < drawlist.length; i += 1)
        {
            var x = drawlist[i].rot_x;
            var y = drawlist[i].rot_y;
            var z = drawlist[i].rot_z;
            var type = drawlist[i].spacePart;

            if((!show_fleet_overlay || current.range > 200) && type == "F")
              continue;
            
            //Position calculations
            //magic numbers here are derived from canvas width and height, with a 10px padding
            var screen_x = canvas.padding+(x-min.x)*((canvas.width-2*canvas.padding)/scale);
            var screen_y = (canvas.height * 0.5)+(z-min.z)*((canvas.height * 0.5 - canvas.padding)/scale);
            var y_offset = (y-min.y)*((canvas.height)/scale) - canvas.height * 0.25;

            if(screen_x > (canvas.width - canvas.padding) || screen_y-y_offset > (canvas.height - canvas.padding))
              continue;
            if(screen_x < canvas.padding || screen_y-y_offset < canvas.padding)
              continue;

            var base_inside_grid = Math.pow(screen_x-(canvas.width * 0.5),2)/Math.pow((canvas.width * 0.5),2) + Math.pow(screen_y-370,2)/Math.pow(120,2) <= 1;

            var object_alpha;
            if(base_inside_grid) {
              object_alpha = object_alpha_min+ object_alpha_range*((z - min.z)/scale);
              if (object_alpha < object_alpha_min)
                object_alpha = object_alpha_min;
            } else {
              object_alpha = 0.2+ (object_alpha_min-0.2)*((z - min.z)/scale);
              if (object_alpha < 0.2)
                object_alpha = 0.2;

            }


            var object_size = current.range >= 300 ? draw_config[type].size_min : easeInQuart(300-current.range, draw_config[type].size_min,draw_config[type].size_max - draw_config[type].size_min ,275)

            var object_angle = 0;
            
            var idx = drawlist[i].idx;
            var sx = (idx%5)*50;
            var sy = Math.floor(idx/5)*50;

            ctx.lineWidth = 1;
            if(type != "F") {
              planet_id = drawlist[i].partId;
            }
            else {//Fleet
              if(base_inside_grid)//highlight fleets on grid
                object_alpha = 1;
              else
                object_alpha = 0.2;
              screen_x += object_size/2;//offset fleet vs planet
              screen_y += object_size/2;
              
              //calculate display angle
              var tempvec = {x: drawlist[i].dX*10+drawlist[i].x, y: drawlist[i].dY*10+drawlist[i].y, z: drawlist[i].dZ*10+drawlist[i].z};
              tempvec = rotate_around_current(tempvec);
              var screen_x2 = canvas.padding+(tempvec.rot_x-min.x)*((canvas.width-2*canvas.padding)/scale) + object_size/2;
              var screen_y2 = (canvas.height * 0.5)+(tempvec.rot_z-min.z)*((canvas.height * 0.5 - canvas.padding)/scale) + object_size/2;
              var y_offset2 = (tempvec.rot_y-min.y)*((canvas.height)/scale) - canvas.height * 0.25;

              var vsx = screen_x2-screen_x;
              var vsy = (screen_y2-y_offset2)-(screen_y-y_offset);
              var scalar_product = (10 * vsx) / (10*Math.sqrt(Math.pow(vsx,2)+Math.pow(vsy,2)));
              object_angle = (vsy >= 0 ? 1 : -1 ) * Math.acos(scalar_product)/Math.PI*180;
            }
            if(base_inside_grid && (draw_config[type].baseline_always || ( draw_baseline_close && draw_config[type].baseline_close)))
            {
                //draw base
                ctx.strokeStyle=draw_config[type].baseline_color;
                ctx.save();
                ctx.beginPath();
                ctx.translate(screen_x,screen_y);
                ctx.scale(1,0.5);
                ctx.arc(0,0,object_size/2,0,2*Math.PI);
                ctx.stroke();
                ctx.restore();

                ctx.beginPath();
                ctx.moveTo(screen_x,screen_y);
                ctx.lineTo(screen_x,screen_y-y_offset);
                ctx.stroke();

                click_ctx.fillStyle="#"+pad(planet_id.toString(16),6,"0");
                click_ctx.fillRect(Math.floor(screen_x-object_size),Math.floor(screen_y-0.5*object_size),Math.floor(2*object_size), Math.floor(object_size));

            }

            //draw object
            ctx.save();
            ctx.translate(screen_x,screen_y-y_offset);
            ctx.rotate(object_angle*Math.PI/180);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "destination-out";
            ctx.drawImage(spritesheet,sx,sy,50,50,0-object_size,0-object_size,2*object_size, 2*object_size);
            ctx.globalCompositeOperation = "source-over";

            ctx.globalAlpha = object_alpha;
            //draw circles for selection and ownership
            var grd;
            if(selected_object !== null && drawlist[i].partId == selected_object){
                grd=ctx.createRadialGradient(0,0,0,0,0,object_size*1.8);
                grd.addColorStop(0.8,"#000");
                grd.addColorStop(0.9,"#ff0");
                ctx.fillStyle=grd;
                ctx.beginPath();
                ctx.arc(0,0,object_size*1.8,0,2*Math.PI);
                ctx.fill();
            }
            if(drawlist[i].flags & (draw_flags.isOwner | draw_flags.isUnion)){
                grd=ctx.createRadialGradient(0,0,0,0,0,object_size*1.5);
                grd.addColorStop(0.8,"#000");
                grd.addColorStop(0.9,drawlist[i].flags & draw_flags.isOwner ? "#0f0" : "#f80");
                ctx.fillStyle=grd;
                ctx.beginPath();
                ctx.arc(0,0,object_size*1.5,0,2*Math.PI);
                ctx.fill();

            }
            //draw the sprite itself
            ctx.drawImage(spritesheet,sx,sy,50,50,0-object_size,0-object_size,2*object_size, 2*object_size);
            ctx.restore();
            //and click target
            if(type != "F") {
              click_ctx.fillStyle="#"+pad(planet_id.toString(16),6,"0");
              click_ctx.fillRect(Math.floor(screen_x-object_size),Math.floor(screen_y-y_offset-object_size),Math.floor(2*object_size), Math.floor(2*object_size));
            } else { // FLEET
              var click_fleet_data = click_ctx.getImageData(Math.floor(screen_x),Math.floor(screen_y-y_offset),1, 1);
              var object_id =(click_fleet_data.data[0] << 16) | (click_fleet_data.data[1] << 8) | click_fleet_data.data[2];
              if(object_id < fleet_index_offset) { //no other fleet here
                click_ctx.fillStyle = "#"+pad(index_number.toString(16),6,"0");
                fleet_index.push([drawlist[i].partId]);
                index_number += 1;
                click_ctx.fillRect(Math.floor(screen_x-object_size),Math.floor(screen_y-y_offset-object_size),Math.floor(2*object_size), Math.floor(2*object_size));
              } else { //Other fleet here
                fleet_index[object_id-fleet_index_offset].push(drawlist[i].partId);
              }
            }


            if(draw_config[type].label !== false) {
              textboxes.push([spaceParts[planet_id][draw_config[type].label],canvas.padding+screen_x,canvas.padding+5+screen_y-y_offset]);
            }

        }
        
        //Heatmap on top of planets and fleets
        if(show_fleet_overlay)
        {
          if(current.range >= 200){
            draw_heatmap();
          }
        }
        //Now draw the Textboxes on top of everything
        ctx.font="14px Georgia";
        for(i = 0; i < textboxes.length; i += 1)
        {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle="#999";
            ctx.fillRect(textboxes[i][1],textboxes[i][2]-13,ctx.measureText(textboxes[i][0]).width+4,18);
            ctx.globalAlpha = 1;
            ctx.fillStyle="yellow";
            ctx.fillText(textboxes[i][0],textboxes[i][1]+2, textboxes[i][2]);
        }
    }


    function animate_transition_start()
    {
        if(animation_blocked)
            return;
        
        check_values();
        animation_start = null;
        start.x = current.x;
        start.y = current.y;
        start.z = current.z;
        start.range = current.range;
        start.angle = current.angle;
        
        if(!animation_running) {
            animation_running = true;
            requestAnimationFrame(animate_transition);
        }
    }

    function animate_transition(time)
    {
        var i;
        if (animation_start === null)
          animation_start = time;
        for(i in current) {
          current[i] = easeInOutCubic(time-animation_start, start[i], target[i]- start[i] , animation_duration);
        }
        draw();

        if(time-animation_start < animation_duration) {
            requestAnimationFrame(animate_transition);
        } else {
            animation_running = false; // end the animation;
            for(i in current) {
              current[i] = target[i];
            }
            if(show_fleet_overlay) {
              fleet_scan_request_start();
            }
            draw();
        }
        $("#viewRangeOfSight").html(Math.floor(current.range));
    }

    // http://www.gizma.com/easing/#cub3
    // t: current time
    // b: starting value
    // c: delta value
    // d: duration
    function easeInOutCubic(t, b, c, d) {
        t /= d/2;
        if (t < 1) return c/2*t*t*t + b;
        t -= 2;
        return c/2*(t*t*t + 2) + b;
    }
    
    function easeInQuart (t, b, c, d) {
        t /= d;
        return c*t*t*t*t + b;
    }

    function draw()
    {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      click_ctx.clearRect(0,0,canvas.width,canvas.height);
      draw_grid();
      draw_space_objects();
    }

    function check_values()
    {
      var round_range = current.range > 200 ? 50 : 25;
      target.range = Math.ceil(target.range / round_range) * round_range; // round to full round_range
      if(target.range <=25)
        target.range = 25;
      if(target.range >=2000)
        target.range = 2000;
      if((target.angle > 360 && current.angle > 360) || (target.angle < -360 && current.angle < -360) ) {
        target.angle %= 360;
        current.angle %= 360;
      }
    }

    function zoom(z) {
      if(animation_blocked)
          return;
      target.range += z;
      animate_transition_start();
    }

    function rotate(r) {
      if(animation_blocked)
          return;
      target.angle += r;
      animate_transition_start();
    }

    function move(x,y,z) {
      if(animation_blocked)
          return;
      var angle = (current.angle % 360) / 180 * Math.PI;
      var xnew = z * Math.sin(angle) - x * Math.cos(angle);
      var znew = x * Math.sin(angle) + z * Math.cos(angle);

      target.x += xnew;
      target.y += y;
      target.z += znew;
      animate_transition_start();
    }

    function reset_view()
    {
      var min = {x:Infinity, y:Infinity, z:Infinity};
      var max = {x:-Infinity, y:-Infinity, z:-Infinity};
      for(var i = 0; i < drawlist.length; i += 1) {
        min.x = Math.min(min.x, drawlist[i].x-50);
        min.y = Math.min(min.y, drawlist[i].y-50);
        min.z = Math.min(min.z, drawlist[i].z-50);
        max.x = Math.max(max.x, drawlist[i].x+50);
        max.y = Math.max(max.y, drawlist[i].y+50);
        max.z = Math.max(max.z, drawlist[i].z+50);
      }
      target.range = Math.max(max.x - min.x,max.y - min.y,max.z - min.z)/2;
      target.x = min.x+(max.x - min.x)/2;
      target.y = min.y+(max.y - min.y)/2;
      target.z = min.z+(max.z - min.z)/2;
      target.angle = 0;
      animate_transition_start();
    }

    function fleet_scan()
    {
      if(show_fleet_overlay) {
        toggleScanButton(false);
        show_fleet_overlay = false;
        draw();
        return;
      }
      if(animation_running) {
        return;
      }

      toggleScanButton(true);
      animate_fleet_scan_start();
      fleet_scan_request_start();
    }
    
    function toggleScanButton(newState)
    {
        var scanButton = $("#fleetScan");
        if (newState) {
            scanButton.css('background-position', '-124px -84px');
        }
        else {
            scanButton.css('background-position', '-124px -44px');
        }
    }

    function animate_fleet_scan_start()
    {
      animation_blocked=true;
      animation_running = true;
      scan_animation_start = null;
      scan_animation_stop = false;
      scan_animation_step = 0;
      requestAnimationFrame(scan_grid);
    }

    function fleet_scan_request_start()
    {
        //Do some AJAX here
        if (current.range >= 200) {
            if(fleet_sectors === undefined) {
              getHeatmap(fleetId, homebaseId, planetId);
            } else {
              scan_animation_stop = 1;
            }
        }
        if (current.range <= 200) {
            getVisibleFleets(fleetId, homebaseId, planetId, current.x, current.y, current.z, current.range);
        }
    }


    function draw_scan_radar(progress) {
      var a = progress*2*Math.PI;

      ctx.save();
      ctx.translate((canvas.width * 0.5),(canvas.height * 0.5));
      ctx.scale(1,canvas.height/canvas.width);
      ctx.fillStyle="rgba(0,255,0,0.2)";
      for(var i = 1; i < 6; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.arc(0,0, 300, a-0.08*i, a, false);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = "#0f0";
      ctx.beginPath();
      ctx.arc(0,0,100,0,2*Math.PI);
      ctx.moveTo(200,0);
      ctx.arc(0,0,200,0,2*Math.PI);
      ctx.moveTo(300,0);
      ctx.arc(0,0,300,0,2*Math.PI);
      ctx.lineTo(-300,0);
      ctx.moveTo(0,300);
      ctx.lineTo(0,-300);
      ctx.stroke();
      ctx.restore();
    }

    function scan_grid(time){

      if (scan_animation_start === null) scan_animation_start = time;
      ctx.globalAlpha = 0.4;

      draw();

      ctx.globalAlpha = 0.4;

      var animation_progress = ((time-scan_animation_start) / scan_animation_duration)%1;

      draw_scan_radar(animation_progress);
      ctx.globalAlpha = 1;
      ctx.strokeStyle="lime";
      ctx.font="bold 40px Courier New ";
      ctx.textAlign="center";
      ctx.strokeText("...SCANNING...",(canvas.width * 0.5),370);
      ctx.textAlign="start";

      if(!scan_animation_stop || (time-scan_animation_start) < scan_animation_duration) {
        requestAnimationFrame(scan_grid);
      } else {
        if(scan_animation_stop == -1) { //ABORT
          animation_blocked = false;
          animation_running = false;
          draw();
        } else if(scan_animation_stop == 1) { //SUCCESS
          if( current.range >= 200 ) {
            scan_animation_start2 = null;
            animation_progress_previous = 0;
            requestAnimationFrame(animate_overlay_appear);
          } else {
            animation_blocked = false;
            animation_running = false;
            show_fleet_overlay = true;
            draw();
          }
        }
        scan_animation_stop = false;
      }
    }

    function animate_overlay_appear(time) {
      if(scan_animation_start2 === null)
        scan_animation_start2 = time;
      var animation_progress = ((time-scan_animation_start) / (scan_animation_duration))%1;
      if(animation_progress < animation_progress_previous)
        animation_progress = animation_progress_previous;
      else
        animation_progress_previous = animation_progress;
      ctx.globalAlpha = 0.4;
      draw();
      ctx.globalAlpha = 0.4;
      draw_scan_radar(animation_progress);
      ctx.globalAlpha = 1;
      draw_heatmap(animation_progress);

      if(time-scan_animation_start2 <= scan_animation_duration) {
          requestAnimationFrame(animate_overlay_appear);
      } else {
        animation_blocked = false;
        animation_running = false;
        show_fleet_overlay = true;
        draw();
      }
    }
    
    function draw_heatmap(section)
    {
      if(section === undefined)
        section = 1;
      for(var type in fleet_sectors) {
        var fst = fleet_sectors[type];
        var max_in_sector=-1;
        for(var i in fst) {
          max_in_sector = Math.max(max_in_sector, fst[i]);
        }
        if(max_in_sector == -1) {
          return;
        }

        var scale = current.range*2;

        var min = {
          x : current.x - current.range,
          y : current.y - current.range,
          z : current.z - current.range
        };

        for(var sector in fst)
        {
            var xyz = sector.split("-");
            xyz = rotate_around_current({x:parseInt(xyz[0])+25,y:parseInt(xyz[1])+25,z:parseInt(xyz[2])+25});
            //Position calculations
            //magic numbers here are derived from canvas width and height, with a 10px padding
            var screen_x = canvas.padding+(xyz.rot_x-min.x)*((canvas.width-2*canvas.padding)/scale);
            var screen_y = (canvas.height * 0.5)+(xyz.rot_z-min.z)*((canvas.height * 0.5 - canvas.padding)/scale);
            var y_offset = (xyz.rot_y-min.y)*((canvas.height)/scale) - canvas.height * 0.25;
            
            var angle = Math.atan2(screen_y-y_offset-(canvas.height * 0.5), screen_x-(canvas.width * 0.5));
            if( angle < 0)
              angle += 2*Math.PI;

            if(angle > section * 2 * Math.PI)
              continue;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.translate(screen_x,screen_y-y_offset);
            var grd=ctx.createRadialGradient(0,0,0,0,0,100);
            var fdct = fleet_draw_config[type];
            grd.addColorStop(0.1,fdct.gradient_start1+Math.floor((fst[sector] / max_in_sector)*fdct.gradient_factor)+fdct.gradient_start2);
            grd.addColorStop(1,"rgba(0,0,0,0)");


            ctx.fillStyle=grd;
            ctx.beginPath();
            ctx.scale(1,0.397);
            ctx.arc(0,0,100,0,2*Math.PI);
            ctx.fill();
            ctx.restore();
        }
      }
    }

    

    function fleet_scan_abort() {
      scan_animation_stop = -1;
    }

    function focusFleet(fleetid) {
      var this_fleet = fleets[fleetid];
      if(this_fleet === undefined) {
        return;
      }
      target.x = parseInt(this_fleet.x);
      target.y = parseInt(this_fleet.y);
      target.z = parseInt(this_fleet.z);
      selected_object = fleetid;
      
      
      //Zoom on target
      target.range = current.range > 200 ? 200 : (current.range > 100 ? 100 : current.range);
      $("#canvasTooltip").css("display", "none");
      animate_transition_start();

    }
    
    function update_fleet_list() {
      var myCanvasFleets = $("#myCanvasFleets tbody");
      var foreignCanvasFleets = $("#foreignCanvasFleets tbody");
      
      if(!show_fleet_overlay) {
        myCanvasFleets.html("<tr class=\"queueItemOdd\"><td colspan=\"5\">"+translate.activate_scan_to_see_fleets+"</td></tr>");
        foreignCanvasFleets.html("<tr class=\"queueItemOdd\"><td colspan=\"4\">"+translate.activate_scan_to_see_fleets+"</td></tr>");
        return;
      }
      var myfleets_html = [];
      var foreignfleets_html = [];
      var actions = "";
      for(var i in fleets) {
        actions = "<span onclick=\"focusFleet("+i+")\" class=\"noborder clickable\">GoTo</span>";
        if(fleets[i].fleetType == "myFleets" && (list_all_my_fleets === true || calc_dist(current, fleets[i]) < current.range)){
          myfleets_html.push([fleets[i].name, fleets[i].label, fleets[i].state+"/"+fleets[i].mission, fleets[i].destination, actions].join("</td><td>"));
        }
        if(fleets[i].fleetType == "foreignFleets" && (list_all_foreign_fleets === true || calc_dist(current, fleets[i]) < current.range)){
          foreignfleets_html.push([fleets[i].name, fleets[i].label, fleets[i].state+"/"+fleets[i].mission, actions].join("</td><td>"));
        }
        
      }
      
      myCanvasFleets.html("<tr class=\"queueItemOdd\"><td>"+myfleets_html.join("</td></tr><tr class=\"queueItemOdd\"><td>")+"</td></tr>");
      
      if(current.range > 200 && list_all_foreign_fleets == false)
        return

      foreignCanvasFleets.html("<tr class=\"queueItemOdd\"><td>"+foreignfleets_html.join("</td></tr><tr class=\"queueItemOdd\"><td>")+"</td></tr>");
      
      
    }
    


});