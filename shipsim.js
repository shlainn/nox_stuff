function in_array(item,arr) {
  var p;
  for(p=0;p<arr.length;p+=1) {
    if (item == arr[p]) {
      return true;
    }
  }
  return false;
}

function count_by_name(arr) {
  count={};
  for(var i = 0; i < arr.length; i += 1) {
    if(count[arr[i].Name] === undefined) {
      count[arr[i].Name] = 0;
    }
    count[arr[i].Name] += 1;
  }
  return count;
}


//glas: 5
//silicium 50
//vana 3.33
//eh: 10
//cfk 12

var ship_types = {
"B00nglider": {
Name: "B00nglider",
Schild: 10,
Panzerung: 20,
Wendigkeit: 95,
Sichtweite: 75 ,
Zielgenauigkeit: 90,
Waffenstaerke: 1,
Boom: 10,
Crew: 2,
Kosten: 10*5 + 1*50+ 10*3.33 + 35*12 + 0*10
},

"Haku": {
Name: "Haku",
Schild: 250,
Panzerung: 1000,
Wendigkeit: 50,
Sichtweite: 150 ,
Zielgenauigkeit: 80,
Waffenstaerke: 3,
Boom: 100,
Crew: 5,
Kosten: 20*5 + 10*50+ 120*3.33 + 50*12 + 20*10
},

"Brander": {
Name: "Brander",
Schild: 750,
Panzerung: 1500,
Wendigkeit: 40,
Sichtweite: 200 ,
Zielgenauigkeit: 80,
Waffenstaerke: 5,
Boom: 150,
Crew: 10,
Kosten: 35*5 + 20*50+ 300*3.33 + 50*12 + 25*10
},

"Atakebune": {
Name: "Atakebune",
Schild: 1500,
Panzerung: 3500,
Wendigkeit: 20,
Sichtweite: 250 ,
Zielgenauigkeit: 90,
Waffenstaerke: 10,
Boom: 300,
Crew: 20,
Kosten: 60*5 + 60*50+ 750*3.33 + 450*12 + 25*10
},

"TheBigOne": {
Name: "TheBigOne",
Schild: 2000,
Panzerung: 8000,
Wendigkeit: 10,
Sichtweite: 280 ,
Zielgenauigkeit: 80,
Waffenstaerke: 15,
Boom: 500,
Crew: 40,
Kosten: 200*5 + 250*50+ 2000*3.33 + 750*12 + 200*10
}
}

var step;
// for(step = 0; step <= 1200; step += 40) {

function do_battle(g1, g2, repeat_max) {
  
var repeat = 0;
var win1 = 0;
var win2 = 0;
var tie = 0;
var rounds = 0;

if (repeat_max === undefined) {
  repeat_max = 1;
}

var group1losses = {};
var group2losses = {};
var group1start, group2start;

for(repeat = 0; repeat < repeat_max; repeat += 1) {

var i,j, t;


//fill groups;

var group1 = [];
for(t in g1) {
  for(i = 0; i < g1[t]; i += 1) {
    group1.push(Object.create(ship_types[t]));
  }
}
group1start = count_by_name(group1);


var group2 = [];
for(t in g2) {
  for(i = 0; i < g2[t]; i += 1) {
    group2.push(Object.create(ship_types[t]));
  }
}
group2start = count_by_name(group2);

// console.log("Start: ",count_by_name(group1),count_by_name(group2));

var round = 1;
while((group1.length > 0 && group2.length >0) && round < 100) {
//   console.log("Round start ",round, group1.length, group2.length);
  //reset shields
  for(i = 0; i < group1.length; i += 1) {
    group1[i].Schild = ship_types[group1[i].Name].Schild;
  }
  for(i = 0; i < group2.length; i += 1) {
    group2[i].Schild = ship_types[group2[i].Name].Schild;
  }
  var group1dead = [];
  var group2dead = [];
  group1stats = {shots : 0, hits: 0, damage: 0, evades: 0};
  group2stats = {shots : 0, hits: 0, damage: 0, evades: 0};
  for (i = 0; i < group1.length; i += 1) {
    for(j = 0; j < group1[i].Waffenstaerke; j += 1) {
      group1stats.shots += 1;
      //pick random ship from other group
      var target = Math.floor(Math.random()*group2.length);
      if ( Math.floor(Math.random()*100) <= group1[i].Zielgenauigkeit ) {
	group1stats.hits += 1;
	if ( Math.floor(Math.random()*100) > group2[target].Wendigkeit ) {
	  var damage = group1[i].Boom;
	  group1stats.damage += damage;
	  if (group2[target].Schild < damage) {
	    damage -= group2[target].Schild;
	    group2[target].Schild = 0;
	  } else {
	    group2[target].Schild -= damage;
	    damage = 0;
	  }
	  if (group2[target].Panzerung < damage) {
	    group2[target].Panzerung = 0;
	    if(!in_array(target,group2dead) ) {
	      group2dead.push(target);
	    }
	  } else {
	    group2[target].Panzerung -= damage;
	    damage = 0;
	  }
	} else {
	  group1stats.evades += 1;
	}
	
      }
    }
  }
  for (i = 0; i < group2.length; i += 1) {
    for(j = 0; j < group2[i].Waffenstaerke; j += 1) {
      group2stats.shots += 1;
      //pick random ship from other group
      var target = Math.floor(Math.random()*group1.length);
      if ( Math.floor(Math.random()*100) <= group2[i].Zielgenauigkeit ) {
	group2stats.hits += 1;
	if ( Math.floor(Math.random()*100) > group1[target].Wendigkeit ) {
	  var damage = group2[i].Boom;
	  group2stats.damage += damage;

	  if (group1[target].Schild < damage) {
	    damage -= group1[target].Schild;
	    group1[target].Schild = 0;
	  } else {
	    group1[target].Schild -= damage;
	    damage = 0;
	  }
	  if (group1[target].Panzerung < damage) {
	    group1[target].Panzerung = 0;
	    if(!in_array(target,group1dead) ) {
	      group1dead.push(target);
	    }
	  } else {
	    group1[target].Panzerung -= damage;
	    damage = 0;
	  }
	} else {
	  group2stats.evades += 1;

	}
      }
    }
  }

  
  //Take note of dead ships and remove them from lists. Then repeat.
//   console.log("Losses:",round,group1dead.length,group2dead.length);
//   console.log("Stats:",round,group1stats,group2stats);
var lost;
  group1dead.sort(function(a,b){return a - b})
  for (i = group1dead.length - 1; i >= 0; i -= 1) {
    lost = group1[group1dead[i]].Name;
    if(group1losses[lost] === undefined) {
      group1losses[lost] = 0;
    }
    group1losses[lost] += 1;
     
    group1.splice(group1dead[i],1);
  }
  group2dead.sort(function(a,b){return a - b})
  for (i = group2dead.length - 1; i >= 0; i -= 1) {
    lost = group2[group2dead[i]].Name;
    if(group2losses[lost] === undefined) {
      group2losses[lost] = 0;
    }
    group2losses[lost] += 1;
    
    group2.splice(group2dead[i],1);
  }
  
  
  
  round += 1;
}

// console.log("Combat end ",round, group1.length, group2.length);
// console.log("End: ",count_by_name(group1),count_by_name(group2));

if( group1.length == 0 && group2.length == 0) {
  tie += 1; 
  win1 += 0.5;
  win2 += 0.5;
} else {
  if( group1.length == 0 ) {
    win2 += 1;
  }
  if( group2.length == 0 ) {
    win1 += 1;
  }
}
rounds += round - 1;
}
var kosten=0;
for(i in group1losses) {
  group1losses[i] /= repeat_max;
  group1losses[i+"_kosten"] =group1losses[i] * ship_types[i].Kosten
  kosten += group1losses[i] * ship_types[i].Kosten
}
group1losses["total_kosten"] = kosten;

kosten = 0;
for(i in group2losses) {
  group2losses[i] /= repeat_max;
  group2losses[i+"_kosten"] = group2losses[i] * ship_types[i].Kosten
  kosten += group2losses[i] * ship_types[i].Kosten
}
group2losses["total_kosten"] = kosten;

var output = {"win1": win1, "win2": win2, "tie": tie, "dauer_schnitt": rounds/repeat_max, "start1": group1start, "start2": group2start, "loss1": group1losses, "loss2": group2losses};
// console.log(win1, win2, tie,rounds/repeat_max, group1losses.total_kosten, group2start, group2losses.total_kosten);
// console.log(group1start, group2start);
// console.log(group1losses,group2losses);

  return output;
}
// }

