importScripts("shipsim.js");
self.addEventListener('message', function(e) {
  var data = e.data;
  var result = do_battle(data.attacker, data.defender, data.r);
  self.postMessage({"result":result,"name":data.name,"r":data.r});
  self.close();
},false );