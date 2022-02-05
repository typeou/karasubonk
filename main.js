const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

var mainWindow;
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  })

  mainWindow.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

setInterval(() => {
  var status = 0;
  if (socket == null)
    status = 1;
  else if (!connectedVTube)
    status = 2;
  else if (calibrateStage == 0 || calibrateStage == 1)
    status = 3;
  else if (calibrateStage == 2 || calibrateStage == 3)
    status = 4;

  mainWindow.webContents.send("status", status);
}, 1000);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Main process code
const fs = require("fs");
var data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));

// PubSub authentication for listening to events
const { ApiClient } = require('twitch');
const { StaticAuthProvider } = require('twitch-auth');
var authProvider;
var apiClient;

async function pubSub(apiClient) {
  const { PubSubClient } = require('twitch-pubsub-client');

  const pubSubClient = new PubSubClient();

  const userID = await pubSubClient.registerUserListener(apiClient);

  await pubSubClient.onRedemption(userID, onRedeemHandler);
  await pubSubClient.onSubscription(userID, onSubHandler);
  await pubSubClient.onBits(userID, onBitsHandler);
}

// Acquire token if one doesn't exist yet
if (data.accessToken == "")
{
  //require('electron').shell.openExternal("https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=u4rwa52hwkkgyoyow0t3gywxyv54pg&redirect_uri=https://twitchapps.com/tokengen/&scope=channel%3Aread%3Aredemptions%20channel_subscriptions%20bits%3Aread");
}
else
{
  authenticate();
}

ipcMain.on('authenticate', () => authenticate());
function authenticate() {
  authProvider = new StaticAuthProvider("u4rwa52hwkkgyoyow0t3gywxyv54pg", data.accessToken);
  apiClient = new ApiClient({ authProvider });
  pubSub(apiClient);
}

// Websocket server for browser source
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

var socket, connectedVTube = false;

wss.on('connection', function connection(ws)
{
  socket = ws;
  ws.on('message', function message(request)
  {
    request = JSON.parse(request);
    if (request.type == "calibrating")
    {
      switch (request.stage)
      {
        case "min":
          if (request.size > -99)
          {
            calibrateStage = 0;
            calibrate();
          }
          else
          {
            setData(request.modelID + "Min", [ request.positionX, request.positionY ]);
            calibrateStage = 2;
            calibrate();
          }
          break;
        case "max":
          if (request.size < 99)
          {
            calibrateStage = 2;
            calibrate();
          }
          else
          {
            setData(request.modelID + "Max", [ request.positionX, request.positionY ]);
            calibrateStage = 4;
            calibrate();
          }
          break;
      }
    }
    else if (request.type == "status")
      connectedVTube = request.connectedVTube;
  });
  ws.on('close', function message()
  {
    socket = null;
  });
});

function getImageSoundMagnitude()
{
  const index = Math.floor(Math.random() * data.throws.length);
  return [data.throws[index][0], data.throws[index][1], data.throws[index][2] != null ? data.throws[index][2] : data.impacts[Math.floor(Math.random() * data.impacts.length)]];
}

function getImagesSoundsMagnitudes()
{
  var imagesSoundsMagnitudes = [];

  for (var i = 0; i < data.barrageCount; i++)
    imagesSoundsMagnitudes.push(getImageSoundMagnitude());

  return imagesSoundsMagnitudes;
}

ipcMain.on('single', () => single());
ipcMain.on('barrage', () => barrage());
ipcMain.on('bits', () => onBitsHandler());

function single()
{
  if (socket != null) {
    const imageSoundMagnitude = getImageSoundMagnitude();

    var request =
    {
      "type": "single",
      "image": imageSoundMagnitude[0],
      "magnitude": imageSoundMagnitude[1],
      "sound": imageSoundMagnitude[2],
      "data": data
    }
    socket.send(JSON.stringify(request));
  }
}

function barrage()
{
  if (socket != null) {
    const imagesSoundsMagnitudes = getImagesSoundsMagnitudes();
    var images = [], sounds = [], magnitudes = [];
    for (var i = 0; i < imagesSoundsMagnitudes.length; i++) {
      images[i] = imagesSoundsMagnitudes[i][0];
      magnitudes[i] = imagesSoundsMagnitudes[i][1];
      sounds[i] = imagesSoundsMagnitudes[i][2];
    }

    var request = {
      "type": "barrage",
      "image": images,
      "sound": sounds,
      "magnitude": magnitudes,
      "data": data
    }
    socket.send(JSON.stringify(request));
  }
}

ipcMain.on('startCalibrate', () => startCalibrate());
ipcMain.on('nextCalibrate', () => nextCalibrate());

var calibrateStage = -1;
function startCalibrate()
{
  calibrateStage = 0;
  calibrate();
}

function nextCalibrate()
{
  calibrateStage++;
  calibrate();
}

function calibrate()
{
  var request = {
    "type": "calibrating",
    "stage": calibrateStage
  }
  socket.send(JSON.stringify(request));
}

ipcMain.on("setData", (_, arg) =>
{
  setData(arg[0], arg[1])
});

function setData(field, value)
{
  data[field] = value;
  fs.writeFileSync(__dirname + "/data.json", JSON.stringify(data));
}

function resetData()
{
  data = {
    "singleRedeemID": "",
    "barrageRedeemID": "",

    "subEnabled": true,
    "subGiftEnabled": true,
    "subIsBarrage": true,

    "singleBitsEnabled": true,
    "singleBitsCount": 100,
    "barrageBitsEnabled": true,
    "barrageBitsCount": 500,

    "barrageCount": 30,
    "barrageFrequency": 0.1,

    "returnSpeed": 0.05,

    "delay": 150,

    "volume": 0.1,

    "parametersHorizontal": ["FaceAngleX", "FaceAngleZ", "FacePositionX"],

    "parametersVertical": ["FaceAngleY"],

    "faceHeightMin": 0,
    "faceHeightMax": 0,

    "portThrower": 8080,
    "portVTubeStudio": 8001,

    "accessToken": ""
  }
  fs.writeFileSync(__dirname + "/data.json", JSON.stringify(data));
}

function onRedeemHandler(redemptionMessage)
{
  switch (redemptionMessage.rewardTitle) {
    case data.singleRedeemTitle:
      single();
      break;
    case data.barrageRedeemTitle:
      barrage();
      break;
  }
}

function onSubHandler(subMessage)
{
  if ((data.subEnabled && !subMessage.isGift) || (data.subGiftEnabled && subMessage.isGift)) {
    if (data.subIsBarrage)
      barrage();
    else
      single();
  }
}

function onBitsHandler(bitsMessage)
{
  if (data.bitsEnabled) {
    var totalBits = Math.floor(Math.random() * 20000); //bitsMessage.totalBits;

    var num10k = 0, num5k = 0, num1k = 0, num100 = 0;
    while (totalBits + num100 + num1k + num5k + num10k > data.maxBitsBarrageCount)
    {
      // Maximum number of possible 10k bit icons
      const max10k = Math.floor(totalBits / 10000);
      // Number of 10k bit icons to be thrown
      var temp = Math.floor(Math.random() * max10k) + max10k > 0 ? 1 : 0;
      num10k += temp;
      // Subtract from total bits
      totalBits -= temp * 10000;
  
      // Repeat process for 5k, 1k, and 100 bit icons
      const max5k = Math.floor(totalBits / 5000);
      var temp = Math.floor(Math.random() * max5k) + max5k > 0 ? 1 : 0;
      num5k += temp;
      totalBits -= temp * 5000;
  
      const max1k = Math.floor(totalBits / 1000);
      var temp = Math.floor(Math.random() * max1k) + max1k > 0 ? 1 : 0;
      num1k += temp;
      totalBits -= temp * 1000;
  
      const max100 = Math.floor(totalBits / 100);
      var temp = Math.floor(Math.random() * max100) + max100 > 0 ? 1 : 0;
      num100 += temp;
      totalBits -= temp * 100;
    }

    var bitThrows = [];
    while (num10k-- > 0)
      bitThrows.push(10000);
    while (num5k-- > 0)
      bitThrows.push(5000);
    while (num1k-- > 0)
      bitThrows.push(1000);
    while (num100-- > 0)
      bitThrows.push(100);
    while (totalBits-- > 0)
      bitThrows.push(1);
    
    if (socket != null) {
      var images = [], sounds = [], magnitudes = [];
      while (bitThrows.length > 0)
      {
        switch (bitThrows.splice(Math.floor(Math.random() * bitThrows.length), 1)[0])
        {
          case 1:
            images.push("throws/1.png");
            magnitudes.push(0.2);
            break;
          case 100:
            images.push("throws/100.png");
            magnitudes.push(0.4);
            break;
          case 1000:
            images.push("throws/1000.png");
            magnitudes.push(0.6);
            break;
          case 5000:
            images.push("throws/5000.png");
            magnitudes.push(0.8);
            break;
          case 10000:
            images.push("throws/10000.png");
            magnitudes.push(1);
            break;
        }
        sounds.push(data.impacts[Math.floor(Math.random() * data.impacts.length)]);
      }

      var request = {
        "type": "barrage",
        "image": images,
        "sound": sounds,
        "magnitude": magnitudes,
        "data": data
      }
      socket.send(JSON.stringify(request));
    }
  }
}