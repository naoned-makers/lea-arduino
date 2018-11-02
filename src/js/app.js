import SerialPort from 'serialport';
import Configuration from "./config/configuration";
import logger from "./helpers/log";
import { playSound } from "./helpers/sound";
import mqtt from "mqtt";
import os from "os";

var arduinoPortName;
var arduinoPort;

let clientMqtt;
let isArduinoMessageDisplayed = false;
let freshTweets = [];


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
  logger.log('debug', "New message");
  let payload = JSON.parse(strPayload.toString());
  freshTweets.push(payload);
  checkPort();
});


/**
 * Détermine quel port correspond à l'arduino
 * @param msg
 */
function getCurrentPort() {
  logger.log('debug', "getCurrentPort");
  SerialPort
    .list(function(err, ports) {
      ports.forEach(function(port) {
        let val = port['manufacturer']
        if (typeof val !== 'undefined' &&  val.toLowerCase().includes("arduino")) {
          logger.log('debug', port.comName);
          arduinoPortName = port.comName;
          arduinoPort = new SerialPort(arduinoPortName);
          arduinoPort.on('open', function() {
            logger.log('debug', "PORT OUVERT");
            writeDataOnArduinoSerial();
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
function writeDataOnArduinoSerial() {
  isArduinoMessageDisplayed = true;
  //while (freshTweets.length > 0) {
    logger.log('debug', 'size: ' + freshTweets.length);
    console.log("writeDataOnArduinoSerial freshTweets");
    console.log(freshTweets)
    let tweet = freshTweets.splice(0,1)[0];
    logger.log('debug', 'size: ' + freshTweets.length);
    console.log(tweet);

    logger.log('debug', "Entry in writeDataOnArduinoSerial", isArduinoMessageDisplayed);
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
              clientMqtt.publish('lea/arduino/brain', JSON.stringify({action: Configuration.processConst.ACTION.END_SHOW_TWEET_ON_ARDUINO, tweet: tweet}));
              if (freshTweets.length > 0) {
                writeDataOnArduinoSerial();
              }
            }, 7500);
          }, 2500);
          isArduinoMessageDisplayed = false;
        } else {
          setTimeout(function() {
            logger.log('debug', "Le tweet historique vient de finir de s'afficher sur l'arduino !");
            clientMqtt.publish('lea/arduino/brain', JSON.stringify({action: Configuration.processConst.ACTION.END_SHOW_TWEET_ON_ARDUINO, tweet: tweet}));
            isArduinoMessageDisplayed = false;
          }, 10000);
        }

    });
  //}
}

function checkPort() {
  logger.log('debug', "checkPort");
  logger.log('debug', arduinoPortName);
  // Envoi du tweet par le port série avec serialPort
  if (arduinoPort == '' || arduinoPort == undefined) {
    // Détermination du port de communication de l'Arduino
    logger.log('info', "Le port de l'Arduino est absent. Il faut le déterminer...");
    getCurrentPort();
  } else {
    // Ecriture sur le port série de l'Arduino
    logger.log('info', "Ecriture sur le port série de l'Arduino");
    checkPortAvailable();
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
