var http = require('http');
var fs = require('fs');

// enter bridge ip
var HUE_BRIDGE_IP = '0';
// enter hue user
var HUE_USER = '0';
var HUE_PATH = '/api/' + HUE_USER + '/';
var bombPlantTime = 0;
var lastBlinkTime = 0;
var currentStatus = null;
var currentLight = 1;
var currentLightColor;
var currentLightsColors = ['none', 'none', 'none'];
var blinkOn = true;
var lights = [];
var bombTickTime = 1000;
var roundData = {
	round: false,
	phase: null,
	team: '',
	health: 0,
	bomb: ''
};

var numUpdates = 0;

port = 3000;
host = '127.0.0.1';

var server = http.createServer(function(req, res){
	if(req.method == 'POST') {
		console.log("Handling POST request...");
		res.writeHead(200, {'Content-Type': 'text/html'});
		
		var body = '';
		req.on('data', function(data) {
			body += data;
		});
		req.on('end', function(){
			console.log("POST payload: " + body);
			update(JSON.parse(body));
			res.end('');
		});
	}
	else
	{
		console.log("Not expecting other request types...");
		res.writeHead(200, {'Content-Type': 'text/html'});
		var html = '<html><body>HTTP server at http://' + host + ':' + port + '</body></html>';
		res.end(html);
	}
});

function moveToNextLight(){
	currentLight++;
	if(currentLight == 4)
		currentLight = 1;
}

function checkStatus(){
	if(roundData.round){
		if(roundData.bomb === 'planted'){
			numUpdates += 1;
			console.log(numUpdates);
			console.log("PLANTED!");
			if(currentStatus === null){
				bombPlantTime = Date.now();
				currentStatus = 'planted';
				
				changeLight(1, redLights(), 'red');
				changeLight(2, noLights(), 'none');
				changeLight(3, noLights(), 'none');
				moveToNextLight();
			}
			var timeSincePlant = Date.now() - bombPlantTime;
					
			if(timeSincePlant - lastBlinkTime >= bombTickTime){
				// blink the next light, cancel the last
				blinkLightsForBomb();
				lastBlinkTime = Date.now() - bombPlantTime;
				if(timeSincePlant >= 20000){
					bombTickTime -= 9;
				}
				else{
					bombTickTime -= 22;
				}
			}
		}
		else if(roundData.bomb === 'exploded'){
			console.log("EXPLODED!");
			changeAllLights(yellowLights(), 'yellow');
		}
		else if(roundData.bomb === 'defused'){
			console.log("DEFUSED!");
			changeAllLights(blueLights(), 'blue');
		}
		else{
			if(roundData.phase === 'freezetime'){
				resetBombTimes();
				currentLight = 1;
			}
			if(roundData.health === 0){
				console.log("DEAD");
				changeAllLights(redLights(), 'red');
			}
			else if(roundData.team === 'T'){
				console.log("T");
				changeAllLights(brownLights(), 'brown');
			}
			else if(roundData.team === 'CT'){
				console.log("CT");
				changeAllLights(blueLights(), 'blue');
		}
		else{
			console.log("NOTHING.............");
			changeAllLights(whiteLights(), 'white')
			}
		}
	}
}

function resetBombTimes(){
	lastBlinkTime = 0;
	bombTickTime = 1000;
	currentStatus = null;
}

function update(json){
	if(json.round){
		roundData.round = true;
		if(json.round.phase === 'freezetime'){
			roundData.phase = 'freezetime';
		}
		else{
			roundData.phase = null;
		}
		roundData.bomb = json.round.bomb;
		if(json.player){
			roundData.team = json.player.team;
			roundData.health = json.player.state.health;
		}
	}
	else{
		roundData.round = false;
		roundData.bomb = '';
		roundData.team = '';
		roundData.health = 0;
	}
}

function areSameColor(light1, light2){
	if(light1.sat != light2.sat || light1.bri != light2.bri || light1.hue != light2.hue){
		return false;
	}
	return true;
}

function changeLight(lightNum, lightColor, lightName){
	// if the current light is not the color its supposed to change to
	if(lightName != currentLightsColors[lightNum]){
		console.log("------------CHANGING LIGHT-------------")
		var jsonString = JSON.stringify(lightColor);
		http.request({
			host: HUE_BRIDGE_IP,
			path: HUE_PATH + 'lights/' + lightNum + '/state',
			method: 'PUT',
			headers: {
			'Content-Type': 'application/json',
			'Content-Length': jsonString.length
			}
		}, function() {

		}).write(jsonString);

		currentLightsColors[lightNum] = lightName;
	}	
}

function changeAllLights(lightColor, lightName){
	changeLight(1, lightColor, lightName);
	changeLight(2, lightColor, lightName);
	changeLight(3, lightColor, lightName);
}

function blinkLightsForBomb() {
	// switches current light to red
	changeLight(currentLight, redLights(), 'red');
	// turns off the previous light
	switch(currentLight){
		case 1:
			changeLight(3, noLights(), 'none');
			break;
		case 2:
			changeLight(1, noLights(), 'none');
			break;
		case 3:
			changeLight(2, noLights(), 'none');
			break;
		default:
			changeLight(currentLight, noLights(), 'none');
			break;
	}
	// changes the current light to the next light
	moveToNextLight();
}

function redLights(lightNum){
	currentLightsColors[lightNum] = 'red';
	return {
		'on' : true,
		'sat' : 254,
		'bri' : 254,
		'hue' : 0,
		'transitiontime' : 0
	}
}

function yellowLights(lightNum) {
	currentLightsColors[lightNum] = 'yellow';
	return {
		'on': true,
		'sat': 254,
		'bri': 254,
		'hue': 10000,
		'transitiontime': 0
	}
}

function blueLights(lightNum) {
	currentLightsColors[lightNum] = 'blue';
	return {
		'on': true,
		'sat': 254,
		'bri': 254,
		'hue': 45000,
		'transitiontime': 0
	}
}

function whiteLights(lightNum) {
	currentLightsColors[lightNum] = 'white';
	return {
		'on': true,
		'sat': 0,
		'bri': 254,
		'hue': 10000
	}
}

function brownLights(lightNum) {
	currentLightsColors[lightNum] = 'brown';
	return {
		'on': true,
		'sat': 174,
		'bri': 254,
		'hue': 5460
	}
}

function noLights(lightNum) {
	currentLightsColors[lightNum] = 'none';
	return {
		'on': false,
		'transitiontime': 0
	}
}

setInterval(checkStatus, 150);

server.listen(port, host);
console.log('Listening at http://' + host + ':' + port);