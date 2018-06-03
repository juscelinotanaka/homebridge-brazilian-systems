
# homebridge-brazilian-systems

FYI: This README is incomplete yet.

Homebridge plugin to handle some specific situations of brazilian systems which in a lot of times behaves in a different way from products around the world.
Mostly, it is related with the **garage door**, **alarm systems** and **door systems**.
This plugin is not meant to be used as a stable version of something. It is a workaround to integrate simple technologies on a homekit ecosystem.

# Installation
Not available.

homebridge-brazilian-systems use wiring-pi lib which require to run as root.
In /etc/systemd/system/homebridge.service, update : `User=root`

# Configuration
Configuration example:
```
{
	"accessories": [
		{
			"accessory": "BRDevice",
			"name": "Alarm",
			"type": "alarm",
			"buttonpin": 4,
			"statuspin" : 5
		},
		{
			"accessory": "BRDevice",
			"name": "Garage",
			"type": "garagedoor",
			"buttonpin": 5
		},
		{
			"accessory": "BRDevice",
			"name": "Entrance",
			"type": "door",
			"buttonpin": 7
		}
	],

	"platforms":[]
}
```

`pin` numbers must be specified as BCM pin number in the `Pin Configuration` table below

## Pin Configuration

wPi pin number must be used in config file

```
 +-----+-----+---------+------+---+---Pi 2---+---+------+---------+-----+-----+
 | BCM | wPi |   Name  | Mode | V | Physical | V | Mode | Name    | wPi | BCM |
 +-----+-----+---------+------+---+----++----+---+------+---------+-----+-----+
 |     |     |    3.3v |      |   |  1 || 2  |   |      | 5v      |     |     |
 |   2 |   8 |   SDA.1 |  OUT | 0 |  3 || 4  |   |      | 5V      |     |     |
 |   3 |   9 |   SCL.1 |   IN | 1 |  5 || 6  |   |      | 0v      |     |     |
 |   4 |   7 | GPIO. 7 |   IN | 1 |  7 || 8  | 1 | ALT0 | TxD     | 15  | 14  |
 |     |     |      0v |      |   |  9 || 10 | 1 | ALT0 | RxD     | 16  | 15  |
 |  17 |   0 | GPIO. 0 |   IN | 0 | 11 || 12 | 1 | IN   | GPIO. 1 | 1   | 18  |
 |  27 |   2 | GPIO. 2 |  OUT | 0 | 13 || 14 |   |      | 0v      |     |     |
 |  22 |   3 | GPIO. 3 |   IN | 0 | 15 || 16 | 0 | IN   | GPIO. 4 | 4   | 23  |
 |     |     |    3.3v |      |   | 17 || 18 | 0 | IN   | GPIO. 5 | 5   | 24  |
 |  10 |  12 |    MOSI |   IN | 0 | 19 || 20 |   |      | 0v      |     |     |
 |   9 |  13 |    MISO |   IN | 0 | 21 || 22 | 0 | IN   | GPIO. 6 | 6   | 25  |
 |  11 |  14 |    SCLK |   IN | 0 | 23 || 24 | 1 | IN   | CE0     | 10  | 8   |
 |     |     |      0v |      |   | 25 || 26 | 1 | IN   | CE1     | 11  | 7   |
 |   0 |  30 |   SDA.0 |   IN | 1 | 27 || 28 | 1 | IN   | SCL.0   | 31  | 1   |
 |   5 |  21 | GPIO.21 |   IN | 1 | 29 || 30 |   |      | 0v      |     |     |
 |   6 |  22 | GPIO.22 |   IN | 1 | 31 || 32 | 0 | IN   | GPIO.26 | 26  | 12  |
 |  13 |  23 | GPIO.23 |   IN | 0 | 33 || 34 |   |      | 0v      |     |     |
 |  19 |  24 | GPIO.24 |   IN | 0 | 35 || 36 | 0 | IN   | GPIO.27 | 27  | 16  |
 |  26 |  25 | GPIO.25 |   IN | 0 | 37 || 38 | 0 | IN   | GPIO.28 | 28  | 20  |
 |     |     |      0v |      |   | 39 || 40 | 0 | IN   | GPIO.29 | 29  | 21  |
 +-----+-----+---------+------+---+----++----+---+------+---------+-----+-----+
 | BCM | wPi |   Name  | Mode | V | Physical | V | Mode | Name    | wPi | BCM |
 +-----+-----+---------+------+---+---Pi 2---+---+------+---------+-----+-----+
```

# Type of accessories

## alarm
on common brazilian security system we have a push button which can
be used to toggle the alarm system. Alarm systems also have a output pin that can be used to check if the alarm is on or off (only). It may be possible to implement a system to check if the alarm goes off, but it is not the case here.

## garagedoor
First of all, most of the Brazilian garage door slides to the sides, and not top-bottom. On Brazilian garage door system we also have a single push button that can be used to make the garage door cycle like this: "open -> pause -> close -> pause -> open". It is a cycle that changes everytime you press the button. It means we can open a garage door for just 1 meter and then stop. Then you click this button again the garage closes.
This accessory is a simple swith which will be used to mimic a toggle and send a single to the garage door system.
I hope I can find some solution to implement the GarageDoor system, but right now it will only be a fake-push button.

## door
Brazilian door system? PUSH BUTTON! It is just a lock that whenever you press a button it unlocks the door, and that is it. You don't know the state of the door and not even if it really opened. (Unless you use an external/independent sensor). So, it is basically another toggle switch that will mimic a push button.
