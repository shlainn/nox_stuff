$(document).ready(function()
{
    // load language array
    var userLang = $("#userLang").text();
    $.getScript("../js/lang_"+userLang+".js").done();

    $("#canvasMapArea").click(function(event) { canvasmap_click(event); });
    $("#canvasMapArea").mousemove(function(event) { canvasmap_move(event); });
    $("#canvasMapArea").mouseover(function() { canvasmap_tooltip_start(); });
    $("#canvasMapArea").mouseout(function() { canvasmap_tooltip_stop(); canvasmap_drag_stop();});
    $("#canvasMapArea").mousedown(function(event) {canvasmap_drag_start(event);});
    $("#canvasMapArea").mouseup(function() {canvasmap_drag_stop();});
    
    $("#rotationBase").mousedown(function(){eye_move_start();});
    $("#rotationBase").mouseup(function(){eye_move_stop();});
    $("#rotationBase").mousemove(function(event){eye_move(event);});
    $("#rotationBase").click(function(event){eye_move(event,true);});
    
    $("#resetView").click(function() { reset_view(); });
    $("#zoomIn").click(function() { zoom(current.range>200 ? -200 : -current.range / 2); });
    $("#zoomOut").click(function() { zoom(current.range>200 ? 200 : current.range); });

    $("#moveLeft").click(function() { move(-current.range/2,0,0); });
    $("#moveRight").click(function() { move(current.range/2,0,0); });
    $("#moveForward").click(function() { move(0,current.range/2,0); });
    $("#moveBack").click(function() { move(0,-current.range/2,0); });
    
    $("#fleetScan").click(function() { fleet_scan(); });
    
    $("#canvasMyFleetListAll").click(function() { toggleFleetList(0); });
    $("#canvasForeignFleetListAll").click(function() { toggleFleetList(1); });
    
    var scan_animation_start, scan_animation_start2, scan_animation_step, scan_animation_stop = false;
    var animation_progress_previous = 0;
    var fleets_loaded = false;
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
      "S" : {"label": "sName", "size_min": 8, "size_max": 50},
      "H" : {"label": false, "size_min": 5, "size_max": 20},
      "P" : {"label": false, "size_min": 4, "size_max": 25},
      "F" : {"label": false, "size_min": 4, "size_max": 6}
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
    var start = {x:0, y: 0, z: 0, range: 0, angleX: 0, angleY: 0};//for animating.
    var target = {x: viewPosX,y: viewPosY,z: viewPosZ, range: viewRange, angleX: 0, angleY: 0};
    var current = {x: viewPosX,y: viewPosY,z: viewPosZ, range: 2000, angleX: -90, angleY: 90};

    var spritesheet = new Image();
    spritesheet.onload = function(){getSpaceParts(fleetId, homebaseId, planetId);};
    spritesheet.src = $("#planetSrc").text();
    
    var c=$("#canvasMapArea");
    var ctx=c[0].getContext("2d");
    var cc=$("#canvasMapArea_click");
    var click_ctx=cc[0].getContext("2d");

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
                      if(result.hasOwnProperty(fleetType)) {
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
                }
                fleets_loaded = true;
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

    var eye_drag = false;
    function eye_move_start() {
      eye_drag = true;
    }
    
    function eye_move_stop() {
      eye_drag = false;
    }
    
    function eye_move(e, click) {
      if(!eye_drag && !click)
        return;
      
      if (!e)
        e = window.event;
      var parentOffset = $("#rotationBase").offset();
      var offsetX = Math.floor(e.pageX - parentOffset.left);
      var offsetY = Math.floor(e.pageY - parentOffset.top);
      if(offsetY > 106)
        offsetY = 106;
      if (offsetY < 0)
        offsetY = 0;
      if(offsetX > 106)
        offsetX = 106;
      if (offsetX < 0)
        offsetX = 0;
      
      $("#rotationEye").css({"top": offsetY-10,"left": offsetX-10});

      if(click) {
        target.angleY = 90-180*offsetX/106;
        target.angleX = -90+180*offsetY/106;
        animate_transition_start();
      } else {
        current.angleX = -90+180*offsetY/106;
        current.angleY = 90-180*offsetX/106;
        target.angleY = current.angleY;
        target.angleX = current.angleX;
        draw();
      }
      c.css({"background-position-x": -(2048-630)*(offsetX/106),"background-position-y": -(2048-630)*(offsetY/106)});
    }
    
    var map_drag = false, map_drag_prevent_click = false, map_was_dragged = false;
    var map_drag_position, map_start_position;
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
      map_start_position = {x:current.x, y: current.y, z: current.z};
      
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
      var angleY = (current.angleY % 360) / 180 * Math.PI;
      var angleX = (current.angleX % 360) / 180 * Math.PI;

      //drag
      if(map_drag) {
        map_was_dragged = true;
        var deltaX = -(offsetX - map_drag_position.offsetX)*(scale/canvas.width);
        var deltaY = -(offsetY - map_drag_position.offsetY)*(scale/canvas.height);
        var deltaZ = 0;
        //rotate around Y
        var xnew = deltaX * Math.cos(angleY) - deltaZ * Math.sin(angleY);
        var znew = deltaX * Math.sin(angleY) + deltaZ * Math.cos(angleY);
        //rotate around X
        var ynew = deltaY * Math.cos(angleX) + znew * Math.sin(angleX);
        znew = deltaY * Math.sin(angleX) - znew * Math.cos(angleX);        
        
        current.x = map_start_position.x+xnew;
        current.y = map_start_position.y+ynew;
        current.z = map_start_position.z+znew;
        target.x = current.x;
        target.y = current.y;
        target.z = current.z;
        draw();

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
        var tipText = spaceParts[object_id].label+"<br />"+spaceParts[object_id].posLabel+"<br />"+_gt("Distance")+": "+distance+" pc<br />";
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
      var screen_y = canvas.padding+(temp.rot_y-min.y)*((canvas.height-2*canvas.padding)/scale);
      tooltip.css("display", "block");
      tooltip.offset({"top": parseInt(parentOffset.top+screen_y)+3,"left": parseInt(parentOffset.left)+screen_x+15});
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
        $("#canvasMapItemInfo").html(_gt("NoPartSelected"));
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
          tipText += _gt("SendText")+"</a>";
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
          iteminfohtml.push(this_fleet.name+"<br>"+_gt(this_fleet.state)+" / "+_gt(this_fleet.mission)+"<br>("+this_fleet.x+"/"+this_fleet.y+"/"+this_fleet.z+")");
        }        
        $("#canvasMapItemInfo").html(iteminfohtml.join("<hr>"));
      }       
      draw();
    }

    
    function rotate_around_current(vector)
    {
        var angleY = (current.angleY % 360) / 180 * Math.PI;
        var angleX = (current.angleX % 360) / 180 * Math.PI;
        var x = vector.x-current.x;
        var y = vector.y-current.y;
        var z = vector.z-current.z;
        //rotate around X
        var ynew = y * Math.cos(angleX) + z * Math.sin(angleX);
        var znew = z * Math.cos(angleX) - y * Math.sin(angleX);
        //rotate around Y
        var xnew = x * Math.cos(angleY) - znew * Math.sin(angleY);
        znew = znew * Math.cos(angleY) + x * Math.sin(angleY);
        
        vector.rot_x = xnew + current.x;
        vector.rot_y = ynew + current.y;
        vector.rot_z = znew + current.z;
        return vector;
    }

    function pad(n, width, z)
    {
      z = z || '0';
      n = n + '';
      return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }

    
    function draw_space_objects()
    {
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
            var screen_y = canvas.padding+(y-min.y)*((canvas.height-2*canvas.padding)/scale);

            if(screen_x > (canvas.width - canvas.padding) || screen_y > (canvas.height - canvas.padding))
              continue;
            if(screen_x < canvas.padding || screen_y < canvas.padding)
              continue;


            var object_alpha = object_alpha_min+ object_alpha_range*((z - min.z)/scale);
            if(object_alpha > 1)
              object_alpha = 1 - (object_alpha - 1);
            if (object_alpha < object_alpha_min)
              object_alpha = object_alpha_min;


            var object_size = current.range >= 300 ? draw_config[type].size_min : easeInQuart(300-current.range, draw_config[type].size_min,draw_config[type].size_max - draw_config[type].size_min ,275);

            var object_angle = 0;
            
            var idx = drawlist[i].idx;
            var sx = (idx%5)*50;
            var sy = Math.floor(idx/5)*50;

            ctx.lineWidth = 1;
            if(type != "F") {
              planet_id = drawlist[i].partId;
            }
            else {//Fleet
              object_alpha = 1;

              screen_x += object_size/2;//offset fleet vs planet
              screen_y += object_size/2;
              
              //calculate display angle
              var tempvec = {x: drawlist[i].dX*10+drawlist[i].x, y: drawlist[i].dY*10+drawlist[i].y, z: drawlist[i].dZ*10+drawlist[i].z};
              tempvec = rotate_around_current(tempvec);
              var screen_x2 = canvas.padding+(tempvec.rot_x-min.x)*((canvas.width-2*canvas.padding)/scale) + object_size/2;
              var screen_y2 = canvas.padding+(tempvec.rot_y-min.y)*((canvas.height-2*canvas.padding)/scale) + object_size/2;

              var vsx = screen_x2-screen_x;
              var vsy = (screen_y2)-(screen_y);

              var scalar_product = (10 * vsx) / (10*Math.sqrt(Math.pow(vsx,2)+Math.pow(vsy,2)));
              object_angle = (vsy >= 0 ? 1 : -1 ) * Math.acos(scalar_product)/Math.PI*180;
            }

            //draw object
            ctx.save();
            ctx.translate(screen_x,screen_y);
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
              click_ctx.fillRect(Math.floor(screen_x-object_size),Math.floor(screen_y-object_size),Math.floor(2*object_size), Math.floor(2*object_size));
            } else { // FLEET
              var click_fleet_data = click_ctx.getImageData(Math.floor(screen_x),Math.floor(screen_y),1, 1);
              var object_id =(click_fleet_data.data[0] << 16) | (click_fleet_data.data[1] << 8) | click_fleet_data.data[2];
              if(object_id < fleet_index_offset) { //no other fleet here
                click_ctx.fillStyle = "#"+pad(index_number.toString(16),6,"0");
                fleet_index.push([drawlist[i].partId]);
                index_number += 1;
                click_ctx.fillRect(Math.floor(screen_x-object_size),Math.floor(screen_y-object_size),Math.floor(2*object_size), Math.floor(2*object_size));
              } else { //Other fleet here
                fleet_index[object_id-fleet_index_offset].push(drawlist[i].partId);
              }
            }


            if(draw_config[type].label !== false) {
              textboxes.push([spaceParts[planet_id][draw_config[type].label],canvas.padding+screen_x,canvas.padding+5+screen_y]);
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
        ctx.font="12px Georgia";
        for(i = 0; i < textboxes.length; i += 1)
        {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle="#999";
            ctx.fillRect(textboxes[i][1],textboxes[i][2]-10,ctx.measureText(textboxes[i][0]).width+4,12);
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
        
        for(var i in current) {
          if(current.hasOwnProperty(i)){
            start[i] = current[i];
          }
        }
        
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
          if(current.hasOwnProperty(i)) {
            current[i] = easeInOutCubic(time-animation_start, start[i], target[i]- start[i] , animation_duration);
          }
        }
        draw();
        if(time-animation_start < animation_duration) {
            requestAnimationFrame(animate_transition);
        } else {
            animation_running = false; // end the animation;
            for(i in current) {
              if(current.hasOwnProperty(i)) {
                current[i] = target[i];
              }
            }
            if(show_fleet_overlay) {
              fleet_scan_request_start();
              update_fleet_list();
            }
            draw();
        }
        $("#viewRangeOfSight").html(Math.floor(current.range));

        var eyeoffsetX = (90-current.angleY)/180*106;
        var eyeoffsetY = (current.angleX+90)/180*106;
        $("#rotationEye").css({"top": eyeoffsetY-10,"left": eyeoffsetX-10});
        c.css({"background-position-x": -(2048-630)*(eyeoffsetX/106),"background-position-y": -(2048-630)*(eyeoffsetY/106)});

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
      draw_space_objects();
    }

    function check_values()
    {
      var round_range = current.range > 200 ? 50 : 25;
      target.range = Math.ceil(target.range / round_range) * round_range; // round to full round_range
      if(target.range <=25)
        target.range = 25;
      if(target.range >=20000)
        target.range = 20000;
      if((target.angleX > 360 && current.angleX > 360) || (target.angleX < -360 && current.angleX < -360) ) {
        target.angleX %= 360;
        current.angleX %= 360;
      }
      if((target.angleY > 360 && current.angleY > 360) || (target.angleY < -360 && current.angleY < -360) ) {
        target.angleY %= 360;
        current.angleY %= 360;
      }

    }

    function zoom(z) {
      if(animation_blocked)
          return;
      target.range += z;
      animate_transition_start();
    }

    function move(x,y,z) {
      if(animation_blocked)
          return;
      var angleY = (current.angleY % 360) / 180 * Math.PI;
      var angleX = (current.angleX % 360) / 180 * Math.PI;
      //rotate around Y
      var xnew = x * Math.cos(angleY) - z * Math.sin(angleY);
      var znew = x * Math.sin(angleY) + z * Math.cos(angleY);
      //rotate around X
      var ynew = y * Math.cos(angleX) + znew * Math.sin(angleX);
      znew = y * Math.sin(angleX) - znew * Math.cos(angleX);

      target.x += xnew;
      target.y += ynew;
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
      target.angleX = 0;
      target.angleY = 0;
      animate_transition_start();
    }

    function fleet_scan()
    {
      if(show_fleet_overlay) {
        toggleScanButton(false);
        show_fleet_overlay = false;
        update_fleet_list();
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
            update_fleet_list();
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
        update_fleet_list();
      }
    }
    
    function draw_heatmap(section)
    {
      if(section === undefined)
        section = 1;
      for(var type in fleet_sectors) {
        if(fleet_sectors.hasOwnProperty(type)) {
          var fst = fleet_sectors[type];
          var max_in_sector=-1;
          for(var i in fst) {
            if(fst.hasOwnProperty(i)) {
              max_in_sector = Math.max(max_in_sector, fst[i]);
            }
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
            if(fst.hasOwnProperty(sector)){
              var xyz = sector.split("-");
              xyz = rotate_around_current({x:parseInt(xyz[0])+25,y:parseInt(xyz[1])+25,z:parseInt(xyz[2])+25});
              //Position calculations
              //magic numbers here are derived from canvas width and height, with a 10px padding
              var screen_x = canvas.padding+(xyz.rot_x-min.x)*((canvas.width-2*canvas.padding)/scale);
              var screen_y = canvas.padding+(xyz.rot_y-min.y)*((canvas.height-2*canvas.padding)/scale);

              var angle = Math.atan2(screen_y-(canvas.height * 0.5), screen_x-(canvas.width * 0.5));
              if( angle < 0)
                angle += 2*Math.PI;

              if(angle > section * 2 * Math.PI)
                continue;
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.translate(screen_x,screen_y);
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
    
    function build_actions_for_fleet(id) {
      
      var actions = "<div class=\"actions\" style=\"margin:0;\"><img id=\"focusFleet_"+id+"\" class=\"resPic clickable\" title=\""+_gt("GoToFleet")+"\" alt=\""+_gt("GoToFleet")+"\" src=\"../pics/defaultSkin/callBack.png\" width=\"20\" height=\"20\"></div>";
      if(fleetId === 0) {//This is not a fleet, return
        return actions;
      }
      if(fleets[id].canBeSupplied == 1) {
        actions += "<div class=\"actions\" style=\"margin:0;\"><a href=\"mil_fleetSupply.php?actionFleetId="+fleets[id].id+"\"><img class=\"resPic\" src=\"../pics/defaultSkin/supply.png\" title=\""+_gt("Supply")+"\" alt=\""+_gt("Supply")+"\" width=\"20\" height=\"20\" style=\"cursor: pointer\" /></a></div>";
      }
      if(fleets[id].canBeMerged == 1) {
        actions += "<div class=\"actions\" style=\"margin:0;\"><a href=\"mil_fleetMerge.php?actionFleetId="+fleets[id].id+"\"><img class=\"resPic\" src=\"../pics/defaultSkin/merge.png\" title=\""+_gt("Merge")+"\" alt=\""+_gt("Merge")+"\" width=\"20\" height=\"20\" style=\"cursor: pointer\" /></a></div>";
      }
      if(fleets[id].canBeAttacked == 1) {
        actions += "<div class=\"actions\" style=\"margin:0;\"><a href=\"mil_fleetAttack"+(fleets[id].fleetType=="alienFleets"?"Alien":"")+".php?actionFleetId="+fleets[id].id+(parseInt(fleets[id].id)===0?"&actionPlanetId="+fleets[id].planetId:"")+"\"><img class=\"resPic\" src=\"../pics/defaultSkin/attack.png\" title=\""+_gt("AttackFleet")+"\" alt=\""+_gt("AttackFleet")+"\" width=\"20\" height=\"20\" style=\"cursor: pointer\" /></a></div>";
      }
      if(fleets[id].canBeInspected == 1) {
        actions += "<div class=\"actions\" style=\"margin:0;\"><a href=\"mil_fleetInspect.php?actionFleetId="+fleets[id].id+"\"><img class=\"resPic\" src=\"../pics/defaultSkin/espionage.png\" title=\""+_gt("InspectFleet")+"\" alt=\""+_gt("InspectFleet")+"\" width=\"20\" height=\"20\" style=\"cursor: pointer\" /></a></div>";
      }
      return actions;
    }
    
    function toggleFleetList(list) {
      if(list === 0){//myFleets
        list_all_my_fleets = !list_all_my_fleets;
        $("#canvasMyFleetListAll").html(list_all_my_fleets ? _gt("ListOnlyVisible") : _gt("ListAllFleets"));
      }
      if(list === 1){//foreignFleets
        list_all_foreign_fleets = !list_all_foreign_fleets;
        $("#canvasForeignFleetListAll").html(list_all_foreign_fleets ? _gt("ListOnlyVisible") : _gt("ListAllFleets"));
      }
      update_fleet_list();
    }
    
    function update_fleet_list() {
      var myCanvasFleets = $("#myCanvasFleets tbody");
      var foreignCanvasFleets = $("#foreignCanvasFleets tbody");
      
      if(!show_fleet_overlay || !fleets_loaded) {
        myCanvasFleets.html("<tr class=\"queueItemOdd\"><td colspan=\"5\">"+_gt("ActivateScanToSeeFleets")+"</td></tr>");
        foreignCanvasFleets.html("<tr class=\"queueItemOdd\"><td colspan=\"4\">"+_gt("ActivateScanToSeeFleets")+"</td></tr>");
      $("#canvasMyFleetCount, #canvasForeignFleetCount").html("");
      $("#canvasMyFleetListAll, #canvasForeignFleetListAll").css({"display":"none"});
      
        return;
      }
      var myfleets = 0, foreignFleets = 0;
      var myfleets_html = [];
      var foreignfleets_html = [];
      var name, status, position, destination, actions;
      var i;
      for(i in fleets) {
        if(fleets.hasOwnProperty(i)) {
          name = fleets[i].name;
          if(fleetId == fleets[i].id) {
            name = "<span class=\"nearlyEnoughResources\">"+name+"</span>";
          }
          if(fleets[i].fleetType == "alienFleets") {
            name = "<span style=\"color: cyan\">"+name+"</span>";
          }
          
          position = fleets[i].posLabel;
          
          if(fleets[i].onVacation == 1) {
            status = _gt("MIL_MAP_LOCAL_ON_VACATION");
          } else {
            status = _gt(fleets[i].state);
            if(fleets[i].state == "OutOfFuel" || fleets[i].state == "OutOfPills") {
              status = "<span class=\"alarm\">"+status+"</span>";
            }
            if(fleets[i].mission != "NoMission") {
              status += " / "+_gt(fleets[i].mission);
            }
          }

          destination = fleets[i].destination;
          actions = build_actions_for_fleet(i);
          if(fleets[i].fleetType == "myFleets") {
            myfleets += 1;
            if (list_all_my_fleets === true || (current.range <= 200 && calc_dist(current, fleets[i]) < current.range)){
              myfleets_html.push([name, position, status, destination, actions].join("</td><td>"));
            }
          }
          if(fleets[i].fleetType != "myFleets") {
            foreignFleets += 1;
            if (list_all_foreign_fleets === true || (current.range <= 200 && calc_dist(current, fleets[i]) < current.range)) {
              foreignfleets_html.push([name, position, status, actions].join("</td><td>"));
            }
          }
        }
      }
      
      if(current.range > 200 && list_all_my_fleets === false) {
          myCanvasFleets.html("<tr class=\"queueItemOdd\"><td colspan=\"5\">"+_gt("TooFarOut")+"</td></tr>");
      } else {
        if(myfleets_html.length > 0) {
          myCanvasFleets.html("<tr class=\"queueItemOdd\"><td>"+myfleets_html.join("</td></tr><tr class=\"queueItemOdd\"><td>")+"</td></tr>");
        } else {
          myCanvasFleets.html("<tr class=\"queueItemOdd\"><td colspan=\"5\">"+_gt("NoFleetsInRange")+"</td></tr>");
        }
      }
      if(current.range > 200 && list_all_foreign_fleets === false) {
          foreignCanvasFleets.html("<tr class=\"queueItemOdd\"><td colspan=\"4\">"+_gt("TooFarOut")+"</td></tr>");
      } else {
        if(foreignfleets_html.length > 0) {
          foreignCanvasFleets.html("<tr class=\"queueItemOdd\"><td>"+foreignfleets_html.join("</td></tr><tr class=\"queueItemOdd\"><td>")+"</td></tr>");
        } else {
          foreignCanvasFleets.html("<tr class=\"queueItemOdd\"><td colspan=\"4\">"+_gt("NoFleetsInRange")+"</td></tr>");
        }
      }
      $("#canvasMyFleetCount").html("("+myfleets_html.length+" / "+myfleets+")");
      $("#canvasForeignFleetCount").html("("+foreignfleets_html.length+" / "+foreignFleets+")");
      $("#canvasMyFleetListAll, #canvasForeignFleetListAll").css({"display":"inline"});
      for(i in fleets) {//Activate the "GoTo" tags
        if(fleets.hasOwnProperty(i)) {
          $("#focusFleet_"+i).click(function(){focusFleet(this.id.split("_")[1]);});
        }
      }      
    }
    


});