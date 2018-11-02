import SerialPort from 'serialport';
import Configuration from "./config/configuration";
import logger from "./helpers/log";
import { playSound } from "./helpers/sound";
import mqtt from "mqtt";
import os from "os";

var arduinoPortName;
var arduinoPort;

let clientMqtt;


//on se connecte au broker (localhost) et on suscribe aux command message
clientMqtt = mqtt.connect('ws://localhost:3001', {
    clientId: 'lea_arduino_' + os.hostname()
});

clientMqtt.on('connect', function () {
  logger.log('debug', "client connecté pour envoyer des messages à l'arduino");
  clientMqtt.subscribe('lea/brain/arduino');
});
  
  
//A new command as arrived
clientMqtt.on('message', function (topic, strPayload) {
  logger.log('debug', "MESSAGE ARDUINO");
  logger.log('debug', topic);
  let payload = JSON.parse(strPayload.toString());
  logger.log('debug', payload);
  checkPort(payload);
});


/**
 * Détermine quel port correspond à l'arduino
 * @param msg
 */
function getCurrentPort(msg) {
  logger.log('debug', "getCurrentPort");
  SerialPort
    .list(function(err, result) {
      result
        .filter(function(val) {
          if (val.manufacturer && val.manufacturer.toLowerCase().startsWith("arduino")) {
            logger.log('debug', val.comName);
            arduinoPortName = val.comName;
            arduinoPort = new SerialPort(arduinoPortName);
            arduinoPort.on('open', function() {
              logger.log('debug', "PORT OUVERT");
              writeDataOnArduinoSerial(msg);
            });
            // open errors will be emitted as an error event
            arduinoPort.on('error', function(err) {
              logger.log('debug', err);
              logger.log('error', 'Error: ', err);
            });
          } else {
            logger.log('error', 'Impossible de trouver un arduino connecté....')
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
  logger.log('debug', "writeDataOnArduinoSerial");
  logger.log('debug', 'écriture du tweet : ' + tweet.LCDText);
  arduinoPort.write("{ 'motion': '" + tweet.motion + "', tweet:'" + tweet.LCDText + "', 'rank':'" + tweet.rank + "'}", function(err) {
    if (err) {
      return logger.log('error', 'Error on write: ', err.message);
    }

      if (tweet.fresh) {
        logger.log('debug', 'Attente de 2,5 s - ' + process.pid);
        setTimeout(function() {
          playSound(tweet.sound);
          setTimeout(function() {
            logger.log('info', "Le nouveau tweet vient de finir de s'afficher sur l'arduino !");
            clientMqtt.publish('lea/arduino/brain',{action: Configuration.processConst.ACTION.END_SHOW_TWEET_ON_ARDUINO, tweet: tweet});
          }, 7500);
        }, 2500);

      } else {
        setTimeout(function() {
          logger.log('debug', "Le tweet historique vient de finir de s'afficher sur l'arduino !");
          clientMqtt.publish('lea/arduino/brain',{action: Configuration.processConst.ACTION.END_SHOW_TWEET_ON_ARDUINO, tweet: tweet});
        }, 10000);
      }

  });
}

function checkPort(msg) {
  logger.log('debug', "checkPort");
  // Envoi du tweet par le port série avec serialPort
  if (arduinoPort == '' || arduinoPort == undefined) {
    // Détermination du port de communication de l'Arduino
    logger.log('info', "Le port de l'Arduino est absent. Il faut le déterminer...");
    getCurrentPort(msg);
  } else {
    // Ecriture sur le port série de l'Arduino
    logger.log('info', "Ecriture sur le port série de l'Arduino");
    writeDataOnArduinoSerial(msg);
  }
}
