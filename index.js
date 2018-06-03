var Accessory, Service, Characteristic, UUIDGen, Types;

var wpi = require('wiringpi-node');
var storage = require('node-persist');
var dhtSensor = require('node-dht-sensor');

module.exports = function(homebridge) {
    console.log("homebridge-brazilian-systems API version: " + homebridge.version);

    // Accessory must be created from PlatformAccessory Constructor
    Accessory = homebridge.platformAccessory;

    // Service and Characteristic are from hap-nodejs
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    Types = homebridge.hapLegacyTypes;

	homebridge.registerAccessory("homebridge-brazilian-systems", "BRDevice", DeviceAccesory);
}

function DeviceAccesory(log, config) {
	this.services = [];

	if(!config.type) throw new Error("'type' parameter is missing");
	if(!config.name) throw new Error("'name' parameter is missing for accessory " + config.type);

	var infoService = new Service.AccessoryInformation();
	infoService.setCharacteristic(Characteristic.Manufacturer, 'Raspberry')
	infoService.setCharacteristic(Characteristic.Model, config.type)
	//infoService.setCharacteristic(Characteristic.SerialNumber, 'Raspberry');
	this.services.push(infoService);

	wpi.setup('gpio');
	switch(config.type) {
        case 'alarm':
            this.device = new Alarm(this, log, config);
            break;
        case 'garagedoor':
            this.device = new GarageDoor(this, log, config);
            break;
        case 'door':
            this.device = new Door(this, log, config);
            break;
        case 'light':
            this.device = new Lightbulb(this, log, config);
            break;
        case 'windowCovering':
            this.device = new WindowCovering(this, log, config);
            break;
        case 'humiditySensor':
            this.device = new HumiditySensor(this, log, config);
            break;

		default:
			throw new Error("Unknown 'type' parameter : " + config.type);
		break;
	}
}

DeviceAccesory.prototype = {
  getServices: function() {
  	return this.services;
 	},

 	addService: function(service) {
 		this.services.push(service);
 	}
}

function HumiditySensor(accesory, log, config) {
	this.log = log;

    if (!config.sensorpin || !config.sensorType)
        throw new Error("'sensorpin' or 'sensorType' parameter are missing for accessory " + config.name);

    if (config.sensorType != 11 && config.sensorType != 22)
        throw new Error("'sensorType' parameter should be 11 (DHT11) or 22 (DHT22 or AM2302) for accessory" + config.name);

    this.sensorpin = config.sensorpin;
    this.sensorType = config.sensorType;

    this.service = new Service.HumiditySensor(config.name);

    this.service.getCharacteristic(Characteristic.CurrentRelativeHumidity)
		.on('get', this.getCurrentHumidity.bind(this));

	accesory.addService(this.service);
}

HumiditySensor.prototype = {
    getCurrentHumidity: function(callback) {
        var self = this;

        dhtSensor.read(self.sensorType, self.sensorpin, function(err, temperature, humidity) {
            if (!err) {
                self.service.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .updateValue(humidity.toFixed(1));

            } else {
                self.log("fail to read HUMIDITY, trying again in 1.5s");
                setTimeout(function () {
                    self.tryGetValueAgain(callback);
                }, 1500);
            }
        });

        callback(null, null);
    },

    tryGetValueAgain: function(callback) {
        var self = this;
        dhtSensor.read(this.sensorType, this.sensorpin, function(err, temperature, humidity) {
            if (!err) {
                self.log("temperature read on HUMIDITY sensor [FALLBACK]: " + temperature);
                self.service.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .updateValue(humidity.toFixed(1));
            } else
                self.log("FAILED to read HUMIDITY sensor [FALLBACK]: ");
        });
    }
}

function WindowCovering(accesory, log, config) {
	this.log = log;
    this.sensorpin = config.sensorpin;
    this.wpi = wpi;

    this.targetPos = 50;
    this.targetHorizontalAngle = 0;

    // wpi.pinMode(this.sensorpin, wpi.INPUT);

    this.service = new Service.WindowCovering(config.name);

    this.service.getCharacteristic(Characteristic.CurrentPosition)
		.on('get', this.getCurrentPosition.bind(this));

    this.service.getCharacteristic(Characteristic.TargetPosition)
		.on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));

    this.service.getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
		.on('get', this.getCurrentHorizontalAngle.bind(this));

    this.service.getCharacteristic(Characteristic.TargetHorizontalTiltAngle)
		.on('get', this.getTargetHorizontalAngle.bind(this))
        .on('set', this.setTargetHorizontalAngle.bind(this));

    this.service.getCharacteristic(Characteristic.PositionState)
		.on('get', this.getPositionState.bind(this));

	accesory.addService(this.service);
}

WindowCovering.prototype = {
    getCurrentHorizontalAngle: function (callback) {
        callback(null, this.targetHorizontalAngle);
    },

    getTargetHorizontalAngle: function (callback) {
        callback(null, this.targetHorizontalAngle);
    },

    setTargetHorizontalAngle: function (newAngle, callback) {
        this.targetHorizontalAngle = newAngle;

        this.service.getCharacteristic(Characteristic.CurrentHorizontalTiltAngle)
            .updateValue(newAngle);

        callback();
    },

    getCurrentPosition: function (callback) {
        callback(null, this.targetPos);
    },

    getTargetPosition: function (callback) {
        callback(null, this.targetPos);
    },

    setTargetPosition: function (newPosition, callback) {
        this.targetPos = newPosition;

        this.service.getCharacteristic(Characteristic.CurrentPosition)
            .updateValue(newPosition);

        callback();
    },

    getPositionState: function (callback) {
        callback(null, Characteristic.PositionState.STOPPED);
    },
}


function Lightbulb(accesory, log, config) {
	this.log = log;
    this.relaypin = config.relaypin;
    this.wpi = wpi;
    this.lastClick = Date.now();
    this.storageKey = 'light:'+config.name+":isOn";
    storage.initSync();
    var stored = storage.getItemSync(this.storageKey);

    if (config.buttonpin != undefined) {
        this.buttonpin = config.buttonpin;
        wpi.pinMode(this.buttonpin, wpi.INPUT);
        wpi.wiringPiISR(this.buttonpin, wpi.INT_EDGE_RISING, this.buttonClicked.bind(this));
    }

    this.inverted = config.inverted === undefined ? false : (config.inverted == "true");

    this.isOn = stored === undefined ? true : stored;

    wpi.pinMode(this.relaypin, wpi.OUTPUT);

    this.service = new Service.Lightbulb(config.name);

    this.service.getCharacteristic(Characteristic.On)
		.on('get', this.getOn.bind(this))
        .on('set', this.setOn.bind(this));

    this.applyOn();

	accesory.addService(this.service);
}

Lightbulb.prototype = {
    buttonClicked: function (delta) {
        var clickTime = Date.now();
        if (clickTime - this.lastClick < 1000)
            return;

        do {
            // avoid multiple clicks
            this.lastClick = Date.now();
        } while(wpi.digitalRead(this.buttonpin) == 1);

        var timePressed = Date.now() - clickTime;

        // this.log("button clicked: " + this.isOn + " -> " + (!this.isOn) + " : " + delta);
        this.isOn = !this.isOn;
        this.applyOn();
    },

    getOn: function (callback) {
        // this.log("get on: " + this.isOn);
        callback(null, this.isOn);
    },

    setOn: function (state, callback) {
        // this.log("set On: " + state);
        this.isOn = state;

        this.applyOn();

        callback();
    },

    applyOn: function() {
        this.wpi.digitalWrite(this.relaypin, this.getInverted(this.isOn ? this.wpi.HIGH : this.wpi.LOW));
        this.service.getCharacteristic(Characteristic.On)
            .updateValue(this.isOn);

        storage.setItemSync(this.storageKey, this.isOn);
    },

    getInverted: function(value) {
        if (this.inverted)
            return value == wpi.LOW ? wpi.HIGH : wpi.LOW;

        return value;
    }
}


function Door(accesory, log, config) {
	this.log = log;
    this.buttonpin = config.buttonpin;
    this.wpi = wpi;
    this.inverted = config.inverted == undefined ? false : (config.inverted == "true");

    this.targetState = Characteristic.LockTargetState.SECURED;

    wpi.pinMode(this.buttonpin, wpi.OUTPUT);
    wpi.digitalWrite(this.buttonpin, this.getInverted(wpi.LOW));

    this.service = new Service.LockMechanism(config.name);

    this.service.getCharacteristic(Characteristic.LockCurrentState)
		.on('get', this.getCurrentState.bind(this))
        .updateValue(Characteristic.LockCurrentState.SECURED);

    this.service.getCharacteristic(Characteristic.LockTargetState)
		.on('get', this.getTargetState.bind(this))
        .on('set', this.setTargetState.bind(this));

	accesory.addService(this.service);
}

Door.prototype = {
    getCurrentState: function (callback) {
        callback(null, Characteristic.LockCurrentState.SECURED);
    },

    getTargetState: function (callback) {
        callback(null, this.targetState);
    },

    setTargetState: function (newState, callback) {
        if (this.targetState == Characteristic.LockTargetState.SECURED &&
            newState == Characteristic.LockTargetState.UNSECURED) {

            this.service.getCharacteristic(Characteristic.LockCurrentState)
                .updateValue(Characteristic.LockCurrentState.UNSECURED);

            this.targetState = Characteristic.LockTargetState.UNSECURED;

            this.pushButton();

            var self = this;
            setTimeout(function(){
                self.service.getCharacteristic(Characteristic.LockTargetState)
                    .updateValue(Characteristic.LockTargetState.SECURED);

                self.service.getCharacteristic(Characteristic.LockCurrentState)
                    .updateValue(Characteristic.LockCurrentState.SECURED);

                self.targetState = Characteristic.LockTargetState.SECURED;
            }, 1000);
        }

        callback();
    },

    pushButton: function () {
        wpi.digitalWrite(this.buttonpin, this.getInverted(wpi.HIGH));

        var self = this;
        setTimeout(function(){
            self.wpi.digitalWrite(self.buttonpin, self.getInverted(self.wpi.LOW));
        }, 500);
    },

    getInverted: function(value) {
        if (this.inverted)
            return value == wpi.LOW ? wpi.HIGH : wpi.LOW;

        return value;
    }
}


function GarageDoor(accesory, log, config) {
	this.log = log;
    this.buttonpin = config.buttonpin;
    this.wpi = wpi;
    this.inverted = config.inverted == undefined ? false : (config.inverted == "true");

    this.targetState = Characteristic.TargetDoorState.CLOSED;

    wpi.pinMode(this.buttonpin, wpi.OUTPUT);
    wpi.digitalWrite(this.buttonpin, this.getInverted(wpi.LOW));

    this.service = new Service.GarageDoorOpener(config.name);

    this.service.getCharacteristic(Characteristic.CurrentDoorState)
		.on('get', this.getCurrentState.bind(this))
        .updateValue(Characteristic.CurrentDoorState.CLOSED);

    this.service.getCharacteristic(Characteristic.TargetDoorState)
		.on('get', this.getTargetDoorState.bind(this))
        .on('set', this.setTargetDoorState.bind(this));

    this.service.getCharacteristic(Characteristic.ObstructionDetected)
		.on('get', this.getObstructionState.bind(this));

	accesory.addService(this.service);
}


GarageDoor.prototype = {
    getObstructionState: function (callback) {
        callback(null, false);
    },

    getCurrentState: function (callback) {
        callback(null, null);
    },

    getTargetDoorState: function (callback) {
        callback(null, this.targetState);
    },

    setTargetDoorState: function (newState, callback) {
        if (this.targetState == Characteristic.TargetDoorState.CLOSED &&
            newState == Characteristic.TargetDoorState.OPEN) {

            this.targetState = Characteristic.TargetDoorState.OPEN;
            this.service.getCharacteristic(Characteristic.CurrentDoorState)
                .updateValue(Characteristic.CurrentDoorState.OPENING);

            this.pushButton();

            var self = this;
            setTimeout(function(){
                self.service.getCharacteristic(Characteristic.TargetDoorState)
                    .updateValue(Characteristic.TargetDoorState.CLOSED);

                self.service.getCharacteristic(Characteristic.CurrentDoorState)
                    .updateValue(Characteristic.CurrentDoorState.CLOSED);

                self.targetState = Characteristic.TargetDoorState.CLOSED;
            }, 500);
        }

        callback();
    },

    pushButton: function () {
        wpi.digitalWrite(this.buttonpin, this.getInverted(wpi.HIGH));

        var self = this;
        setTimeout(function(){
            self.wpi.digitalWrite(self.buttonpin, self.getInverted(self.wpi.LOW));
        }, 500);
    },

    getInverted: function(value) {
        if (this.inverted)
            return value == wpi.LOW ? wpi.HIGH : wpi.LOW;

        return value;
    }
}


function Alarm(accesory, log, config) {
	this.log = log;
    this.statuspin = config.statuspin;
    this.buttonpin = config.buttonpin;
    this.wpi = wpi;
    this.inverted = config.inverted == undefined ? false : (config.inverted == "true");

    this.service = new Service.SecuritySystem(config.name);

    this.service.getCharacteristic(Characteristic.SecuritySystemCurrentState)
		.on('get', this.getCurrentState.bind(this));

    this.service.getCharacteristic(Characteristic.SecuritySystemTargetState)
        .setProps({
            maxValue: 3,
            minValue: 2,
            validValues: [2,3]
        })
		.on('get', this.getTargetState.bind(this))
        .on('set', this.setTargetState.bind(this));



    wpi.pinMode(this.buttonpin, wpi.OUTPUT);
    wpi.digitalWrite(this.buttonpin, this.getInverted(wpi.LOW));


	wpi.pinMode(this.statuspin, wpi.INPUT);
    // wpi.pullUpDnControl(this.statuspin, wpi.PUD_OFF);
    wpi.wiringPiISR(this.statuspin, wpi.INT_EDGE_BOTH, this.stateChange.bind(this));

    this.stateChange(); // sets the alarm state when the system starts

	accesory.addService(this.service);
}

Alarm.prototype = {
    getInverted: function(value) {
        if (this.inverted)
            return value == wpi.LOW ? wpi.HIGH : wpi.LOW;

        return value;
    },

 	stateChange: function(delta) {
 		var state = wpi.digitalRead(this.statuspin);

        this.log("alarm status changed: " + state + " on: " + this.statuspin);

		this.service.getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .updateValue(state
                            ? Characteristic.SecuritySystemCurrentState.NIGHT_ARM
                            : Characteristic.SecuritySystemCurrentState.DISARMED);
 	},

    getCurrentState: function (callback) {
        var state = wpi.digitalRead(this.statuspin);
        realState = state
                ? Characteristic.SecuritySystemCurrentState.NIGHT_ARM
                : Characteristic.SecuritySystemCurrentState.DISARMED;

        callback(null, realState);
    },

    getTargetState: function (callback) {
        var state = wpi.digitalRead(this.statuspin);
        realState = state
                ? Characteristic.SecuritySystemTargetState.NIGHT_ARM
                : Characteristic.SecuritySystemTargetState.DISARM;

        callback(null, realState);
    },

    setTargetState: function (newState, callback) {
        var actualState = wpi.digitalRead(this.statuspin);

        if (actualState == 0 && newState == Characteristic.SecuritySystemTargetState.NIGHT_ARM ||
            actualState == 1 && newState == Characteristic.SecuritySystemTargetState.DISARM) {
                this.pushButton();
        }

        callback();
    },

    pushButton: function () {
        wpi.digitalWrite(this.buttonpin, this.getInverted(wpi.HIGH));

        var self = this;
        setTimeout(function(){
            self.wpi.digitalWrite(self.buttonpin, self.getInverted(self.wpi.LOW));
        }, 500);
    }
}
