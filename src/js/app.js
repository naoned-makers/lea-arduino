import SerialPort from 'serialport';
import Configuration from "./config/configuration";
import logger from "./helpers/log";
import { playSound } from "./helpers/sound";
import mqtt from "mqtt";
import os from "os";

var arduinoPortName;
var arduinoPort;

let clientMqtt;
let optionsMqtt = {QoS: 2, retain: true};

const BRAIN_TO_ARDUINO_CHANNEL = 'lea/brain/arduino';
const ARDUINO_BRAIN_TO_CHANNEL = 'lea/arduino/brain';

//on se connecte au broker (localhost) et on suscribe aux command message
clientMqtt = mqtt.connect('ws://lea.local:3001', {
    clientId: 'lea_arduino_' + os.hostname()
});

clientMqtt.on('connect', function () {
  logger.log('debug', "client connecté pour envoyer des messages à l'arduino");
  clientMqtt.subscribe(BRAIN_TO_ARDUINO_CHANNEL, optionsMqtt);
});
  
  
//A new command as arrived
clientMqtt.on('message', function (topic, strPayload) {
  logger.log('debug', "New message");
  try {
    let payload = JSON.parse(strPayload.toString());
    checkPort(payload);
  } catch (error) {
    logger.log('error', "Format JSON incorrect" + error.message); 
  }
});


/**
 * Détermine quel port correspond à l'arduino
 * @param msg
 */
function getCurrentPort(payload) {
  logger.log('debug', "getCurrentPort");
  SerialPort
    .list(function(err, ports) {
      ports.forEach(function(port) {
        let val = port['manufacturer']
        if (typeof val !== 'undefined' &&  val.toLowerCase().includes("arduino")) {
          logger.log('debug', "Nom du port Arduino " + port.comName);
          arduinoPortName = port.comName;
          arduinoPort = new SerialPort(arduinoPortName);
          arduinoPort.on('open', function() {
            logger.log('debug', "PORT OUVERT");
            writeDataOnArduinoSerial(payload);
          });
          // open errors will be emitted as an error event
          arduinoPort.on('error', function(err) {
            logger.log('debug', err);
            logger.log('error', 'Error: ', err);
          });
        }
      });
    });
}

/**
 * Ecriture du tweet sur le port série de l'Arduino à l'aide de la librairie
 * Serialport. un setTimeout permet de fixer la durée de l'affichage à 10s par tweet.
 * @param msg
 */
function writeDataOnArduinoSerial(tweet) {
  if (tweet.fresh) {
    logger.log('info', "Affichage du message " + tweet.LCDText);
  }
  arduinoPort.write("{ 'motion': '" + tweet.motion + "', tweet:'" + tweet.LCDText + "', 'rank':'" + tweet.rank + "'}", function(err) {
    if (err) {
      return logger.log('error', 'Error on write: ', err.message);
    }

    if (tweet.fresh) {
      playSound(tweet.sound);
      logger.log('info', "Envoi du message sur l'arduino");
    }
    clientMqtt.publish(ARDUINO_BRAIN_TO_CHANNEL, JSON.stringify({action: Configuration.processConst.ACTION.END_SHOW_TWEET_ON_ARDUINO, tweet: tweet}), optionsMqtt);
  });
}

function checkPort(payload) {
  logger.log('debug', "checkPort");
  logger.log('debug', arduinoPortName);
  // Envoi du tweet par le port série avec serialPort
  if (arduinoPort == '' || arduinoPort == undefined) {
    // Détermination du port de communication de l'Arduino
    logger.log('info', "Le port de l'Arduino est absent. Il faut le déterminer...");
    getCurrentPort(payload);
  } else {
    // Ecriture sur le port série de l'Arduino
    logger.log('info', "Ecriture sur le port série de l'Arduino " + payload.LCDText);
    //checkPortAvailable();
    writeDataOnArduinoSerial(payload);
  }
}


function checkPortAvailable() {
  if(isArduinoMessageDisplayed) {
      setTimeout(checkPortAvailable, 1000);
      return;
  }
  //real action
  writeDataOnArduinoSerial();
}
