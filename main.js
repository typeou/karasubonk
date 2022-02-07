const { app, BrowserWindow, ipcMain } = require('electron')
const { PubSubClient } = require('twitch-pubsub-client')
const { ChatClient } = require('twitch-chat-client')

var mainWindow;
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    icon: __dirname + "/icon.ico",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  })

  mainWindow.setResizable(false);
  mainWindow.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

var open = true;
setInterval(() => {
  if (mainWindow != null)
  {
    var status = 0;
    if (!authenticated)
      status = 1
    else if (socket == null)
      status = 2;
    else if (calibrateStage == 0 || calibrateStage == 1)
      status = 3;
    else if (calibrateStage == 2 || calibrateStage == 3)
      status = 4;
    else if (!connectedVTube)
      status = 5;
    else if (listeningSingle)
      status = 6;
    else if (listeningBarrage)
      status = 7;
    else if (!listenersActive)
      status = 8;
    else if (calibrateStage == -1)
      status = 9;
  
    if (open)
      mainWindow.webContents.send("status", status);
  }
}, 100);

var listeningSingle = false, listeningBarrage = false;
ipcMain.on('listenSingle', () => listenSingle());
ipcMain.on('listenBarrage', () => listenBarrage());

function listenSingle()
{
  listeningBarrage = false;
  listeningSingle = !listeningSingle;
}

function listenBarrage()
{
  listeningSingle = false;
  listeningBarrage = !listeningBarrage;
}

app.on('window-all-closed', () => {
  open = false;
  if (process.platform !== 'darwin') app.quit()
})

const defaultData = {
  "portThrower": 8080,
  "portVTubeStudio": 8001,
  "throws": [
      [
          "throws/I_C_Banana.png",
          1,
          3
      ],
      [
          "throws/I_C_Bread.png",
          1,
          3
      ],
      [
          "throws/I_C_Carrot.png",
          1,
          3
      ],
      [
          "throws/I_C_Cheese.png",
          1,
          3
      ],
      [
          "throws/I_C_Cherry.png",
          1,
          3
      ],
      [
          "throws/I_C_Fish.png",
          1,
          3
      ],
      [
          "throws/I_C_Grapes.png",
          1,
          3
      ],
      [
          "throws/I_C_GreenGrapes.png",
          1,
          3
      ],
      [
          "throws/I_C_GreenPepper.png",
          1,
          3
      ],
      [
          "throws/I_C_Lemon.png",
          1,
          3
      ],
      [
          "throws/I_C_Mulberry.png",
          1,
          3
      ],
      [
          "throws/I_C_Mushroom.png",
          1,
          3
      ],
      [
          "throws/I_C_Nut.png",
          1,
          3
      ],
      [
          "throws/I_C_Orange.png",
          1,
          3
      ],
      [
          "throws/I_C_Pear.png",
          1,
          3
      ],
      [
          "throws/I_C_Pie.png",
          1,
          3
      ],
      [
          "throws/I_C_Pineapple.png",
          1,
          3
      ],
      [
          "throws/I_C_Radish.png",
          1,
          3
      ],
      [
          "throws/I_C_RawFish.png",
          1,
          3
      ],
      [
          "throws/I_C_RawMeat.png",
          1,
          3
      ],
      [
          "throws/I_C_RedPepper.png",
          1,
          3
      ],
      [
          "throws/I_C_Strawberry.png",
          1,
          3
      ],
      [
          "throws/I_C_Watermellon.png",
          1,
          3
      ],
      [
          "throws/I_C_YellowPepper.png",
          1,
          3
      ],
      [
          "throws/gnome.png",
          1,
          1,
          "impacts/gnome.mp3",
          1
      ]
  ],
  "impacts": [
      [
          "impacts/punch_general_body_impact_03.wav",
          1
      ],
      [
          "impacts/punch_grit_wet_impact_05.wav",
          1
      ],
      [
          "impacts/punch_heavy_huge_distorted_01.wav",
          1
      ],
      [
          "impacts/Seq 2.1 Hit #1 96 HK1.wav",
          1
      ],
      [
          "impacts/Seq 2.1 Hit #2 96 HK1.wav",
          1
      ],
      [
          "impacts/Seq 2.1 Hit #3 96 HK1.wav",
          1
      ],
      [
          "impacts/Seq 2.27 Hit #1 96 HK1.wav",
          1
      ],
      [
          "impacts/Seq 2.27 Hit #2 96 HK1.wav",
          1
      ],
      [
          "impacts/Seq 2.27 Hit #3 96 HK1.wav",
          1
      ],
      [
          "impacts/Seq1.15 Hit #1 96 HK1.wav",
          1
      ],
      [
          "impacts/Seq1.15 Hit #2 96 HK1.wav",
          1
      ],
      [
          "impacts/Seq1.15 Hit #3 96 HK1.wav",
          1
      ]
  ]
}
// Main process code
const fs = require("fs");
if (!fs.existsSync(__dirname + "/data.json"))
  fs.writeFileSync(__dirname + "/data.json", JSON.stringify(defaultData));
var data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));

// PubSub authentication for listening to events
const { ApiClient } = require('twitch');
const { StaticAuthProvider } = require('twitch-auth');
var authProvider, apiClient, chatClient;

var listenersActive = false;
async function pubSub(apiClient) {
  const pubSubClient = new PubSubClient();

  const userID = await pubSubClient.registerUserListener(apiClient);
  const user = await apiClient.helix.users.getUserById(userID);
  chatClient = new ChatClient(authProvider, { channels: [user.name] });
  await chatClient.connect();
  chatClient.onMessage(onMessageHandler);

  console.log("Listening to Redemptions");
  await pubSubClient.onRedemption(userID, onRedeemHandler);
  console.log("Listening to Subs");
  await pubSubClient.onSubscription(userID, onSubHandler);
  console.log("Listening to Bits");
  await pubSubClient.onBits(userID, onBitsHandler);
  listenersActive = true;
}

var authenticated = false;
var authenticator = setInterval(() => {
  if (!authenticated)
    authenticate();
  else
    clearInterval(authenticator);
}, 3000);

async function authenticate() {
  data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));
  authProvider = new StaticAuthProvider("u4rwa52hwkkgyoyow0t3gywxyv54pg", data.accessToken);
  const token = await authProvider.getAccessToken();
  if (token != null)
  {
    authenticated = true;
    apiClient = new ApiClient({ authProvider });
    pubSub(apiClient);
  }
}

ipcMain.on('oauth', () => require('electron').shell.openExternal("https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=u4rwa52hwkkgyoyow0t3gywxyv54pg&redirect_uri=https://twitchapps.com/tokengen/&scope=chat%3Aread%20chat%3Aedit%20channel%3Aread%3Aredemptions%20channel_subscriptions%20bits%3Aread"));

// Websocket server for browser source
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: data.portThrower });

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

function getImageWeightScaleSoundVolume()
{
  const index = Math.floor(Math.random() * data.throws.length);
  const soundIndex = Math.floor(Math.random() * data.impacts.length);
  return [ data.throws[index][0], data.throws[index][1], data.throws[index][2], data.throws[index][3] != null ? data.throws[index][3] : data.impacts.length > 0 ? data.impacts[soundIndex][0] : null, data.throws[index][3] != null ? data.throws[index][4] : data.impacts.length > 0 ? data.impacts[soundIndex][1] : 0];
}

function getImagesWeightsScalesSoundsVolumes()
{
  var imagesSoundsMagnitudes = [];

  for (var i = 0; i < data.barrageCount; i++)
    imagesSoundsMagnitudes.push(getImageWeightScaleSoundVolume());

  return imagesSoundsMagnitudes;
}

ipcMain.on('single', () => single());
ipcMain.on('barrage', () => barrage());
ipcMain.on('bits', () => onBitsHandler());

function single()
{
  console.log("Sending Single");
  if (socket != null && data.throws.length > 0) {
    const imageWeightScaleSoundVolume = getImageWeightScaleSoundVolume();

    var request =
    {
      "type": "single",
      "image": imageWeightScaleSoundVolume[0],
      "weight": imageWeightScaleSoundVolume[1],
      "scale": imageWeightScaleSoundVolume[2],
      "sound": imageWeightScaleSoundVolume[3],
      "volume": imageWeightScaleSoundVolume[4],
      "data": data
    }
    socket.send(JSON.stringify(request));
  }
}

function barrage()
{
  console.log("Sending Barrage");
  if (socket != null && data.throws.length > 0) {
    const imagesWeightsScalesSoundsVolumes = getImagesWeightsScalesSoundsVolumes();
    var images = [], weights = [], scales = [], sounds = [], volumes = [];
    for (var i = 0; i < imagesWeightsScalesSoundsVolumes.length; i++) {
      images[i] = imagesWeightsScalesSoundsVolumes[i][0];
      weights[i] = imagesWeightsScalesSoundsVolumes[i][1];
      scales[i] = imagesWeightsScalesSoundsVolumes[i][2];
      sounds[i] = imagesWeightsScalesSoundsVolumes[i][3];
      volumes[i] = imagesWeightsScalesSoundsVolumes[i][4];
    }

    var request = {
      "type": "barrage",
      "image": images,
      "weight": weights,
      "scale": scales,
      "sound": sounds,
      "volume": volumes,
      "data": data
    }
    socket.send(JSON.stringify(request));
  }
}

ipcMain.on('startCalibrate', () => startCalibrate());
ipcMain.on('nextCalibrate', () => nextCalibrate());
ipcMain.on('cancelCalibrate', () => cancelCalibrate());

var calibrateStage = -2;
function startCalibrate()
{
  calibrateStage = -1;
  calibrate();
}

function nextCalibrate()
{
  calibrateStage++;
  calibrate();
}

function cancelCalibrate()
{
  calibrateStage = 4;
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

var canSingleCommand = true, canBarrageCommand = true;
function onMessageHandler(_, _, message)
{
  console.log("Received Message");
  if (canSingleCommand && data.singleCommandEnabled && message.toLowerCase() == data.singleCommandTitle.toLowerCase())
  {
    single();
    if (data.singleCommandCooldown > 0)
    {
      canSingleCommand = false;
      setTimeout(() => { canSingleCommand = true; }, data.singleCommandCooldown * 1000);
    }
  }
  else if (canBarrageCommand && data.barrageCommandEnabled && message.toLowerCase() == data.barrageCommandTitle.toLowerCase())
  {
    barrage();
    if (data.barrageCommandCooldown > 0)
    {
      canBarrageCommand = false;
      setTimeout(() => { canBarrageCommand = true; }, data.barrageCommandCooldown * 1000);
    }
  }
}

var canSingleRedeem = true, canBarrageRedeem = true
async function onRedeemHandler(redemptionMessage)
{
  console.log("Received Redeem");
  if (listeningSingle)
  {
    setData("singleRedeemID", redemptionMessage.rewardId);
    listeningSingle = false;
  }
  else if (listeningBarrage)
  {
    setData("barrageRedeemID", redemptionMessage.rewardId);
    listeningBarrage = false;
  }
  else
  {
    switch (redemptionMessage.rewardId) {
      case data.singleRedeemID:
        if (canSingleRedeem && data.singleRedeemEnabled)
        {
          single();
          if (data.singleRedeemCooldown > 0)
          {
            canSingleRedeem = false;
            setTimeout(() => { canSingleRedeem = true; }, data.singleRedeemCooldown * 1000);
          }
        }
        break;
      case data.barrageRedeemID:
        if (canBarrageRedeem && data.barrageRedeemEnabled)
        {
          barrage();
          if (data.barrageRedeemCooldown > 0)
          {
            canBarrageRedeem = false;
            setTimeout(() => { canBarrageRedeem = true; }, data.barrageRedeemCooldown * 1000);
          }
        }
        break;
    }
  }
}

var canSub = true, canSubGift = true;
function onSubHandler(subMessage)
{
  console.log("Received Sub");
  if (canSub && data.subEnabled && !subMessage.isGift) {
    if (data.subType == "barrage")
      barrage();
    else
      single();
    if (data.subCooldown > 0)
    {
      canSub = false;
      setTimeout(() => { canSub = true; }, data.subCooldown * 1000);
    }
  } else if (canSubGift && data.subGiftEnabled && subMessage.isGift) {
    if (data.subGiftType == "barrage")
      barrage();
    else
      single();
    if (data.subGiftCooldown > 0)
    {
      canSubGift = false;
      setTimeout(() => { canSub = true; }, data.subGiftCooldown * 1000);
    }
  }
}

var canBits = true;
function onBitsHandler(bitsMessage)
{
  console.log("Received Bits");
  if (bitsMessage == null || canBits && data.bitsEnabled) {
    if (data.bitsCooldown > 0)
    {
      canBits = false;
      setTimeout(() => { canBits = true; }, data.bitsCooldown * 1000);
    }

    var totalBits = bitsMessage == null ? Math.floor(Math.random() * 20000) : bitsMessage.bits;

    var num10k = 0, num5k = 0, num1k = 0, num100 = 0;
    while (totalBits >= 100 && totalBits + num100 + num1k + num5k + num10k > data.bitsMaxBarrageCount)
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

    if (totalBits + num100 + num1k + num5k + num10k > data.bitsMaxBarrageCount)
      totalBits = data.bitsMaxBarrageCount - (num100 + num1k + num5k + num10k);

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
      var images = [], weights = [], scales = [], sounds = [], volumes = [];
      while (bitThrows.length > 0)
      {
        switch (bitThrows.splice(Math.floor(Math.random() * bitThrows.length), 1)[0])
        {
          case 1:
            images.push("throws/1.png");
            weights.push(0.2);
            break;
          case 100:
            images.push("throws/100.png");
            weights.push(0.4);
            break;
          case 1000:
            images.push("throws/1000.png");
            weights.push(0.6);
            break;
          case 5000:
            images.push("throws/5000.png");
            weights.push(0.8);
            break;
          case 10000:
            images.push("throws/10000.png");
            weights.push(1);
            break;
        }
        scales.push(2);
        if (data.bitImpacts != null && data.bitImpacts.length > 0)
        {
          const soundIndex = Math.floor(Math.random() * data.bitImpacts.length);
          sounds.push(data.bitImpacts[soundIndex][0]);
          volumes.push(data.bitImpacts[soundIndex][1]);
        }
        else if (data.impacts != null && data.impacts.length > 0)
        {
          const soundIndex = Math.floor(Math.random() * data.impacts.length);
          sounds.push(data.impacts[soundIndex][0]);
          volumes.push(data.impacts[soundIndex][1]);
        }
        else
        {
          sounds.push(null);
          volumes.push(0);
        }
      }

      var request = {
        "type": "barrage",
        "image": images,
        "weight": weights,
        "scale": scales,
        "sound": sounds,
        "volume": volumes,
        "data": data
      }
      socket.send(JSON.stringify(request));
    }
  }
}