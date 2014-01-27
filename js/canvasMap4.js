$(document).ready(function()
{
    $("#mapTabs ul").idTabs();
    
    $("#canvasMapArea").click(function(event) { canvasmap_click(event); });
    $("#canvasMapArea").mousemove(function(event) { canvasmap_tooltip(event); });
    $("#canvasMapArea").mouseover(function() { canvasmap_tooltip_start(); });
    $("#canvasMapArea").mouseout(function() { canvasmap_tooltip_stop(); });
    
    $("#resetView").click(function() { reset_view(); });
    $("#zoomIn").click(function() { zoom(-50); });
    $("#zoomOut").click(function() { zoom(50); });
    $("#rotateLeft").click(function() { rotate(-60); });
    $("#rotateRight").click(function() { rotate(60); });

    $("#moveLeft").click(function() { move(-current.range/2,0,0); });
    $("#moveRight").click(function() { move(current.range/2,0,0); });
    $("#moveUp").click(function() { move(0,-current.range/2,0); });
    $("#moveDown").click(function() { move(0,current.range/2,0); });
    $("#moveForward").click(function() { move(0,0,-current.range/2); });
    $("#moveBack").click(function() { move(0,0,current.range/2); });
    
    $("#fleetScan").click(function() { fleet_scan(); });
    
    $("#toggleLines").click(function() {
        draw_config.S.baseline_always = !draw_config.S.baseline_always;
        draw_config.S.baseline_close = !draw_config.S.baseline_close;
        draw_config.P.baseline_close = !draw_config.P.baseline_close;
        draw();
    });

    var scan_animation_start, scan_animation_start2, scan_animation_step, scan_animation_stop = false;
    var animation_progress_previous = 0;
    var show_fleet_heatmap = false;

    var positions, fleets = [], myfleets=[], fleet_sectors, fleet_index;
    var animation_start;
    var animation_running;
    var animation_blocked=false;
    var animation_duration = 1000, scan_animation_duration = 1500;
    var draw_options = {planets_base: false};
    var start = {x:500, y: 500, z: 500, range: 2000, angle: 0};
    var draw_config = {
      "S" : {"baseline_always": true, "baseline_close": true, "baseline_color": "#050", "label": "sName", "size_min": 8, "size_max": 20},
      "H" : {"baseline_always": false, "baseline_close": false, "baseline_color": "#003", "label": false, "size_min": 4, "size_max": 8},
      "P" : {"baseline_always": false, "baseline_close": true, "baseline_color": "#020", "label": false, "size_min": 4, "size_max": 10}
    };
    var fleet_draw_config = {
      "myFleets"    : {"imgoffs":48},
      "unionFleets" : {"imgoffs":0},
      "alienFleets" : {"imgoffs":24,"gradient_start1": "rgba(0,", "gradient_factor": 180, "gradient_start2":",180,0.7)"},
      "foreignFleets":{"imgoffs":72,"gradient_start1": "rgba(180,", "gradient_factor": 180, "gradient_start2":",0,0.7)"},
    };
    
    // Space Part type map onto spritesheet
    // Index number of first sprite of a type
    var types = { "Desert" : 0, "Extentium" : 5, "Fireball" : 10, "Jungle" : 15, "Stone" : 20, "Water" : 25,
        "OrangeDwarf" : 30, "RedDwarf" : 31, "YellowDwarf" : 32, "Homebase": 33
    };

    var fleetId = parseInt($("#fleetId").text());
    var fleetX = parseInt($("#fleetX").text());
    var fleetY = parseInt($("#fleetY").text());
    var fleetZ = parseInt($("#fleetZ").text());
    var fleetRange = parseInt($("#fleetRangeOfSight").text());
    var target = {x: fleetX,y: fleetY,z: fleetZ, range: fleetRange, angle: 0};
    var current = {x: fleetX,y: fleetY,z: fleetZ, range: 2000, angle: 180};

    var spritesheet = new Image();
    spritesheet.onload = function(){getSpaceParts(fleetId);};
    spritesheet.src = $("#planetSrc").text();

    var fighter_size = 5;
    var fightersprite = new Image();
    fightersprite.src = "../fighter.png";
    
    function init()
    {
        positions.sort(function(a,b){return a.z - b.z;});//sort by z coordinate
        reset_view();
    }
    
    function getSpaceParts(fleetId)
    {
        $.ajax(
        {
            type: "POST",
            url: "mil_canvasMap_getAllSpaceParts.php",
            data: "fleetId=" + fleetId,
            async: false,
            success: function(dataArray)
            {
                if (dataArray.length > 0)
                {
                    positions = jQuery.parseJSON(dataArray);
                }
                init();
            },
            error: function()
            {
                alert("FRELL");
            }
        });
    }
    
    function getHeatmap(fleetId, x, y, z, rangeOfSight)
    {
        $.ajax(
        {
            type: "POST",
            url: "mil_canvasMap_getHeatmap.php",
            data: "fleetId=" + fleetId + "&x=" + x + "&y=" + y + "&z=" + z + "&mapRangeOfSight=" + rangeOfSight,
            async: true,
            success: function(dataArray)
            {
                if (dataArray.length > 0)
                {
                    fleet_sectors = jQuery.parseJSON(dataArray);
                }
                scan_animation_stop = 1;
            },
            error: function()
            {
                alert("FRELL");
            }
        });
    }

    function getVisibleFleets(fleetId, x, y, z, rangeOfSight)
    {
        $.ajax(
        {
            type: "POST",
            url: "mil_canvasMap_getVisibleFleets.php",
            data: "fleetId=" + fleetId + "&x=" + x + "&y=" + y + "&z=" + z + "&mapRangeOfSight=" + rangeOfSight,
            async: true,
            success: function(dataArray)
            {
                if (dataArray.length > 0)
                {
                    // "myFleets", "unionFleets", "alienFleets", "foreignFleets"
                    // we only get number of foreign/alien/union fleets if we are too far away
                    fleets = jQuery.parseJSON(dataArray);
                }
                scan_animation_stop = 1;
                draw();
            },
            error: function()
            {
                alert("FRELL");
                scan_animation_stop = -1;
            }
        });
    }
    
    // requestAnim shim layer by Paul Irish
    // thanks to http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    window.requestAnimationFrame = (function()
    {
        return window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function(/* function */ callback, /* DOMElement */ element)
                {
                    window.setTimeout(callback, 1000 / 60); // 16 ms = ~60 fps
                };
    })();

    var c=document.getElementById("canvasMapArea");
    var ctx=c.getContext("2d");
    var cc=document.getElementById("canvasMapArea_click");
    var click_ctx=cc.getContext("2d");

    // click_ctx = ctx; //DEBUG
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

    function canvasmap_tooltip(e)
    {
      if(!tooltip_active)
        return;

      if (!e)
        e = window.event;
      
      var parentOffset = $("#canvasMapArea").offset();
      var offsetX = Math.floor(e.pageX - parentOffset.left);
      var offsetY = Math.floor(e.pageY - parentOffset.top);

      var click_data = click_ctx.getImageData(offsetX,offsetY,1, 1);
      var planet_id =(((click_data.data[1] << 8) | click_data.data[2]) & 0xFFF) -1;
      var fleet_id = ((click_data.data[0]<< 4) | (click_data.data[1] >> 4)) -1 ;
      var tooltip = $("#canvasTooltip");

      if(planet_id == -1 && fleet_id == -1)
      {
        tooltip.css("display", "none");
        return;
      }
      
      if(planet_id != -1)
      {
        tooltip.html(positions[planet_id].label+"<br>"+positions[planet_id].posLabel+"<br>"+"Distance: "+calc_dist({x:fleetX, y:fleetY, z:fleetZ},{x:positions[planet_id].x, y:positions[planet_id].y, z:positions[planet_id].z})+" pc");
      }
      if(fleet_id != -1)
      {
        var index = fleet_index[fleet_id];

        var tooltip_html = [];
        var this_fleet;
        for(var i = 0; i < index.length; i += 1) {
          this_fleet = fleets[index[i].t][index[i].id-1];
          tooltip_html.push(this_fleet.name+"<br>"+this_fleet.state+"/"+this_fleet.mission+"<br>("+this_fleet.x+"/"+this_fleet.y+"/"+this_fleet.z+")");
        }
        tooltip.html(tooltip_html.join("<hr>"));
      }
      tooltip.css("display", "block");
      tooltip.offset({"top": e.pageY,"left": e.pageX+20});
    }

    function canvasmap_click(e)
    {
      if (!e)
        e = window.event;

      var parentOffset = $("#canvasMapArea").offset();
      var offsetX = Math.floor(e.pageX - parentOffset.left);
      var offsetY = Math.floor(e.pageY - parentOffset.top);

      var click_data = click_ctx.getImageData(offsetX,offsetY,1, 1);
      var planet_id =(((click_data.data[1] << 8) | click_data.data[2]) & 0xFFF) -1;

      if(planet_id == -1) {
        return;
      }
      target.x = parseInt(positions[planet_id].x);
      target.y = parseInt(positions[planet_id].y);
      target.z = parseInt(positions[planet_id].z);
      
      //Zoom on target
      target.range -= 100;

      animate_transition_start();
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

      var gridsize = 25 * 1 << Math.floor((scale)/400);
      var gridbase_x = Math.floor(current.x/gridsize)*gridsize;
      var gridbase_z = Math.floor(current.z/gridsize)*gridsize;
      var num_grid = Math.ceil(current.range/gridsize)+1;
      ctx.strokeStyle="#00d";

      ctx.beginPath();
      var v, screen_x, screen_y;
      for(i=-num_grid; i <= num_grid; i += 1) {
        //horizontal line
        v = rotate_around_current({x: gridbase_x+gridsize*i, z: gridbase_z-num_grid*gridsize});
        screen_x = 10+(v.rot_x-min.x)*(610/scale);
        screen_y = 250+(v.rot_z-min.z)*(240/scale);
        ctx.moveTo(screen_x, screen_y);
        v = rotate_around_current({x: gridbase_x+gridsize*i, z: gridbase_z+num_grid*gridsize});
        screen_x = 10+(v.rot_x-min.x)*(610/scale);
        screen_y = 250+(v.rot_z-min.z)*(240/scale);
        ctx.lineTo(screen_x, screen_y);
        //vertical line line
        v = rotate_around_current({x: gridbase_x-num_grid*gridsize, z: gridbase_z+gridsize*i});
        screen_x = 10+(v.rot_x-min.x)*(610/scale);
        screen_y = 250+(v.rot_z-min.z)*(240/scale);
        ctx.moveTo(screen_x, screen_y);
        v = rotate_around_current({x: gridbase_x+num_grid*gridsize, z: gridbase_z+gridsize*i});
        screen_x = 10+(v.rot_x-min.x)*(610/scale);
        screen_y = 250+(v.rot_z-min.z)*(240/scale);
        ctx.lineTo(screen_x, screen_y);
      }
      ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.globalCompositeOperation = "destination-atop";
      ctx.translate(315,370);
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

    function draw_stuff(list)
    {
        var draw_baseline_close = current.range <= 200;
        var i;

        var scale = current.range*2;
        var min = { x : current.x - current.range,
          y : current.y - current.range,
          z : current.z - current.range
        };


        var textboxes = [];

        //Rotate and sort back to front
        for(i = 0; i < list.length; i += 1) {
            list[i] = rotate_around_current(list[i]);
        }

        list.sort(function(a,b){return a.rot_z - b.rot_z;});//sort by z coordinate

        for(i = 0; i < list.length; i += 1)
        {
            var x = list[i].rot_x;
            var y = list[i].rot_y;
            var z = list[i].rot_z;
            var type = list[i].spacePart;

            //Position calculations
            //magic numbers here are derived from canvas width and height, with a 10px padding
            var screen_x = 10+(x-min.x)*(610/scale);
            var screen_y = 250+(z-min.z)*(240/scale);
            var y_offset = (y-min.y)*(250/scale);

            if(screen_x > 620 || screen_y-y_offset > 490)
              continue;
            if(screen_x < 10 || screen_y-y_offset < 10)
              continue;

            var object_alpha = 0.2+ 0.8*((z - min.z)/scale);
            if (object_alpha < 0.2)
              object_alpha = 0.2;


            var object_size = current.range >= 200 ? draw_config[type].size_min : current.range <= 50 ? draw_config[type].size_max : draw_config[type].size_max-Math.floor( ((current.range-50)/150) * (draw_config[type].size_max-draw_config[type].size_min));

            var idx = types[list[i].type]+parseInt(list[i].subType)-1;
            var sx = (idx%5)*50;
            var sy = Math.floor(idx/5)*50;

            ctx.lineWidth = 1;
            var base_inside_grid = Math.pow(screen_x-315,2)/Math.pow(315,2) + Math.pow(screen_y-370,2)/Math.pow(120,2) <= 1;
            var planet_id = i + 1;
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
                click_ctx.save();
                click_ctx.translate(Math.floor(screen_x),Math.floor(screen_y));
                click_ctx.scale(1,0.5);
                click_ctx.fillRect(-object_size,-object_size,2*object_size, 2*object_size);
                click_ctx.restore();
            }

            //draw object
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "destination-out";
            ctx.drawImage(spritesheet,sx,sy,50,50,screen_x-object_size,screen_y-y_offset-object_size,2*object_size, 2*object_size);
            ctx.globalCompositeOperation = "source-over";

            ctx.globalAlpha = object_alpha;
            if(list[i].isOwner == 1){
                var grd=ctx.createRadialGradient(screen_x,screen_y-y_offset,0,screen_x,screen_y-y_offset,object_size*1.5);
                grd.addColorStop(0.8,"#000");
                grd.addColorStop(0.9,"#0f0");
                ctx.fillStyle=grd;
                ctx.beginPath();
                ctx.arc(screen_x,screen_y-y_offset,object_size*1.5,0,2*Math.PI);
                ctx.fill();

            }
            ctx.drawImage(spritesheet,sx,sy,50,50,screen_x-object_size,screen_y-y_offset-object_size,2*object_size, 2*object_size);

            //and click target
            click_ctx.fillStyle="#"+pad(planet_id.toString(16),6,"0");
            click_ctx.fillRect(Math.floor(screen_x-object_size),Math.floor(screen_y-y_offset-object_size),2*object_size, 2*object_size);

            if(draw_config[type].label !== false) {
              textboxes.push([list[i][draw_config[type].label],10+screen_x,15+screen_y-y_offset]);
            }

        }
        
        //Now draw the Textboxes on top of everything
        ctx.font="14px Georgia";
        for(i = 0; i < textboxes.length; i += 1)
        {
            ctx.globalAlpha = 0.7;
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
            if(show_fleet_heatmap && current.range <= 200) {
              getVisibleFleets(fleetId, current.x, current.y, current.z, current.range);
            }
            draw();
        }
        $("#fleetRangeOfSight").html(Math.floor(current.range));
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

    function draw()
    {
      ctx.clearRect(0,0,630,500);
      click_ctx.clearRect(0,0,630,500);
      draw_grid();
      draw_stuff(positions, draw_options);
      if(show_fleet_heatmap)
      {
        if(current.range >= 200)
          draw_heatmap();
        if(current.range <= 200)
          draw_fleet_positions();
      }
    }

    function check_values()
    {
      target.range = Math.ceil(target.range / 50) * 50; // round to full 50
      if(target.range <=50)
        target.range = 50;
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
      for(var i = 0; i < positions.length; i += 1) {
        min.x = Math.min(min.x, parseInt(positions[i].x)-50);
        min.y = Math.min(min.y, parseInt(positions[i].y)-50);
        min.z = Math.min(min.z, parseInt(positions[i].z)-50);
        max.x = Math.max(max.x, parseInt(positions[i].x)+50);
        max.y = Math.max(max.y, parseInt(positions[i].y)+50);
        max.z = Math.max(max.z, parseInt(positions[i].z)+50);
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
      if(show_fleet_heatmap) {
        show_fleet_heatmap = false;
        draw();
        return;
      }
      if(animation_running) {
        return;
      }

      animate_fleet_scan_start();
      fleet_scan_request_start();
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
              getHeatmap(fleetId, current.x, current.y, current.z, current.range);
            } else {
              scan_animation_stop = 1;
            }
        }
        if (current.range <= 200) {
            getVisibleFleets(fleetId, current.x, current.y, current.z, current.range);
        }
    }


    function draw_scan_radar(progress) {
      var r = 300;
      var a = progress*2*Math.PI;

      ctx.save();
      ctx.translate(315,250);
      ctx.scale(1,500/630);
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
      var animation_progress;
      ctx.globalAlpha = 0.4;

      draw();

      ctx.globalAlpha = 0.4;

      animation_progress = ((time-scan_animation_start) / scan_animation_duration)%1;

      draw_scan_radar(animation_progress);
      ctx.globalAlpha = 1;
      ctx.strokeStyle="lime";
      ctx.font="bold 40px Courier New ";
      ctx.textAlign="center";
      ctx.strokeText("...SCANNING...",315,370);
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
            requestAnimationFrame(animate_heatmap_appear);
          } else {
            animation_blocked = false;
            animation_running = false;
            show_fleet_heatmap = true;
            draw();
          }
        }
        scan_animation_stop = false;
      }
    }

    function animate_heatmap_appear(time) {
      if(scan_animation_start2 === null)
        scan_animation_start2 = time;
      animation_progress = ((time-scan_animation_start) / (scan_animation_duration))%1;
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
          requestAnimationFrame(animate_heatmap_appear);
      } else {
        animation_blocked = false;
        animation_running = false;
        show_fleet_heatmap = true;
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
            var screen_x = 10+(xyz.rot_x-min.x)*(610/scale);
            var screen_y = 250+(xyz.rot_z-min.z)*(240/scale);
            var y_offset = (xyz.rot_y-min.y)*(250/scale);
            
            var angle = Math.atan2(screen_y-y_offset-250, screen_x-315);
            if( angle < 0)
              angle += 2*Math.PI;

            if(angle > section * 2 * Math.PI)
              continue;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.translate(screen_x,screen_y-y_offset);
            var grd=ctx.createRadialGradient(0,0,0,0,0,100);
            var fdct = fleet_draw_config[type];
            grd.addColorStop(0.1,fdct["gradient_start1"]+Math.floor((fst[sector] / max_in_sector)*fdct["gradient_factor"])+fdct["gradient_start2"]);
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

    
    function draw_fleet_positions()
    {
      var scale = current.range*2;

      var min = { x : current.x - current.range,
        y : current.y - current.range,
        z : current.z - current.range
      };

      
      fleet_index = [];
      var index_number = 1;
      var i, fleetpos, screen_x, screen_y, y_offset, click_fleet_data, fleet_id;

      for(var type in fleets) {
        for(i = 0; i < fleets[type].length; i += 1) {
          fleetpos = rotate_around_current(fleets[type][i]);

          screen_x = 10+(fleetpos.rot_x-min.x)*(610/scale);
          screen_y = 250+(fleetpos.rot_z-min.z)*(240/scale);
          y_offset = (fleetpos.rot_y-min.y)*(250/scale);
          if(screen_x > 620 || screen_y-y_offset > 490)
            continue;
          if(screen_x < 10 || screen_y-y_offset < 10)
            continue;

          ctx.drawImage(fightersprite,0,fleet_draw_config[type].imgoffs,40,24,screen_x,screen_y-y_offset,2*fighter_size, 1.2*fighter_size);

          click_fleet_data = click_ctx.getImageData(Math.floor(screen_x),Math.floor(screen_y-y_offset),1, 1);
          fleet_id = ((click_fleet_data.data[0]<< 4) | (click_fleet_data.data[1] >> 4)) -1 ;
          if(fleet_id == -1) { //no other fleet here
            click_ctx.fillStyle = "#"+pad(index_number.toString(16),3,"0")+"000";
            fleet_index.push([{"t":type,"id":(i+1)}]);
            index_number += 1;
            click_ctx.fillRect(Math.floor(screen_x),Math.floor(screen_y-y_offset),Math.floor(2*fighter_size), Math.floor(1.2*fighter_size));
          } else { //Other fleet here
            fleet_index[fleet_id].push({"t":type,"id":(i+1)});
          }
        }
      }
    }

    function fleet_scan_abort() {
      scan_animation_stop = -1;
    }

});