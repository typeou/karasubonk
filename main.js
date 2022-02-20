const { app, Menu, Tray, BrowserWindow, ipcMain } = require('electron');
const { PubSubClient } = require('twitch-pubsub-client');
const { ChatClient } = require('twitch-chat-client');

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

  mainWindow.on('restore', () => {
    mainWindow.setSkipTaskbar(false)
  });

  mainWindow.on('minimize', () => {
    mainWindow.setSkipTaskbar(true)
  });
}

var tray = null;
app.whenReady().then(() => {
  tray = new Tray(__dirname + "/icon.ico");
  var contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click: () => { mainWindow.restore(); } },
    { label: 'Quit', role: 'quit' }
  ]);
  tray.setContextMenu(contextMenu)
  tray.on("click", () => { mainWindow.restore(); });

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
    else if (!listenersActive)
      status = 8;
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

// Main process code
const fs = require("fs");
const defaultData = JSON.parse(fs.readFileSync(__dirname + "/defaultData.json", "utf8"));
if (!fs.existsSync(__dirname + "/data.json"))
  fs.writeFileSync(__dirname + "/data.json", JSON.stringify(defaultData));
var data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));

// PubSub authentication for listening to events
const { ApiClient } = require('twitch');
const { ElectronAuthProvider  } = require('twitch-electron-auth-provider');
var authProvider, token, apiClient, chatClient, userID;

var listenersActive = false;
async function pubSub(apiClient) {
  const pubSubClient = new PubSubClient();

  userID = await pubSubClient.registerUserListener(apiClient);
  const user = await apiClient.helix.users.getUserById(userID);
  chatClient = new ChatClient(authProvider, { channels: [user.name] });

  console.log("Listening to Redemptions");
  await pubSubClient.onRedemption(userID, onRedeemHandler);
  console.log("Listening to Subs");
  await pubSubClient.onSubscription(userID, onSubHandler);
  console.log("Listening to Bits");
  await pubSubClient.onBits(userID, onBitsHandler);

  console.log("Listening to Messages");
  await chatClient.connect();
  chatClient.onMessage(onMessageHandler);
  console.log("Listening to Raids");
  chatClient.onRaid(onRaidHandler);
  listenersActive = true;
}

var authenticated = false, authenticating = false;
setInterval(() => {
  if (!authenticated && !authenticating)
    authenticate();
}, 3000);

async function authenticate() {
  data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));
  const clientId = "u4rwa52hwkkgyoyow0t3gywxyv54pg";
  const redirectUri = "https://twitchapps.com/tokengen/&scope=chat%3Aread%20chat%3Aedit%20channel%3Aread%3Aredemptions%20channel_subscriptions%20bits%3Aread";

  authenticating = true;
  authProvider = new ElectronAuthProvider({ clientId, redirectUri });
  authenticating = false;

  token = await authProvider.getAccessToken();
  if (token != null)
  {
    authenticated = true;
    authenticating = false;
    apiClient = new ApiClient({ authProvider });
    pubSub(apiClient);
  }
}

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
            setData(request.modelID + "Min", [ request.positionX, request.positionY ], false);
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
            setData(request.modelID + "Max", [ request.positionX, request.positionY ], false);
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
  var index;
  do {
    index = Math.floor(Math.random() * data.throws.length);
  } while (!data.throws[index].enabled);

  var soundIndex;
  if (hasActiveSound())
  {
    do {
      soundIndex = Math.floor(Math.random() * data.impacts.length);
    } while (!data.impacts[soundIndex].enabled);
  }

  return {
    "location": data.throws[index].location,
    "weight": data.throws[index].weight,
    "scale": data.throws[index].scale,
    "sound": data.throws[index].sound != null ? data.throws[index].sound : hasActiveSound() ? data.impacts[soundIndex].location : null,
    "volume": data.throws[index].sound != null ? data.throws[index].volume : hasActiveSound() ? data.impacts[soundIndex].volume : 0
  };
}

function getImagesWeightsScalesSoundsVolumes()
{
  var getImagesWeightsScalesSoundsVolumes = [];

  for (var i = 0; i < data.barrageCount; i++)
    getImagesWeightsScalesSoundsVolumes.push(getImageWeightScaleSoundVolume());

  return getImagesWeightsScalesSoundsVolumes;
}

ipcMain.on('single', () => single());
ipcMain.on('barrage', () => barrage());
ipcMain.on('bits', () => onBitsHandler());
ipcMain.on('raid', () => onRaidHandler());

ipcMain.on('testItem', (event, message) => handleRaidEmotes(event, message));

function testItem(_, item)
{
  console.log("Testing Item");
  if (socket != null)
  {
    var request =
    {
      "type": "single",
      "image": item.location,
      "weight": item.weight,
      "scale": item.scale,
      "sound": item.sound,
      "volume": item.volume,
      "data": data
    }
    socket.send(JSON.stringify(request));
  }
}

function single()
{
  console.log("Sending Single");
  if (socket != null && hasActiveImage()) {
    const imageWeightScaleSoundVolume = getImageWeightScaleSoundVolume();

    var request =
    {
      "type": "single",
      "image": imageWeightScaleSoundVolume.location,
      "weight": imageWeightScaleSoundVolume.weight,
      "scale": imageWeightScaleSoundVolume.scale,
      "sound": imageWeightScaleSoundVolume.sound,
      "volume": imageWeightScaleSoundVolume.volume,
      "data": data
    }
    socket.send(JSON.stringify(request));
  }
}

function barrage()
{
  console.log("Sending Barrage");
  if (socket != null && hasActiveImage()) {
    const imagesWeightsScalesSoundsVolumes = getImagesWeightsScalesSoundsVolumes();
    var images = [], weights = [], scales = [], sounds = [], volumes = [];
    for (var i = 0; i < imagesWeightsScalesSoundsVolumes.length; i++) {
      images[i] = imagesWeightsScalesSoundsVolumes[i].location;
      weights[i] = imagesWeightsScalesSoundsVolumes[i].weight;
      scales[i] = imagesWeightsScalesSoundsVolumes[i].scale;
      sounds[i] = imagesWeightsScalesSoundsVolumes[i].sound;
      volumes[i] = imagesWeightsScalesSoundsVolumes[i].volume;
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

function getCustomImageWeightScaleSoundVolume(customName)
{
  var index;
  if (hasActiveImageCustom(customName))
  {
    do {
      index = Math.floor(Math.random() * data.throws.length);
    } while (!data.bonks[customName].throws[index].enabled);
  }
  else
  {
    do {
      index = Math.floor(Math.random() * data.throws.length);
    } while (!data.throws[index].enabled);
  }

  var soundIndex;
  if (hasActiveSoundCustom(customName))
  {
    do {
      soundIndex = Math.floor(Math.random() * data.impacts.length);
    } while (!data.bonks[customName].impacts[soundIndex].enabled);
  }
  else if (hasActiveSound)
  {
    do {
      soundIndex = Math.floor(Math.random() * data.impacts.length);
    } while (!data.impacts[soundIndex].enabled);
  }

  return {
    "location": data.bonks[customName].throws[index].location,
    "weight": data.bonks[customName].throws[index].weight,
    "scale": data.bonks[customName].throws[index].scale,
    "sound": data.bonks[customName].throws[index].sound != null ? data.bonks[customName].throws[index].sound : hasActiveSound() ? data.bonks[customName].impacts[soundIndex].location : null,
    "volume": data.bonks[customName].throws[index].sound != null ? data.bonks[customName].throws[index].volume : hasActiveSound() ? data.bonks[customName].impacts[soundIndex].volume : 0
  };
}

function getCustomImagesWeightsScalesSoundsVolumes(customName)
{
  var getImagesWeightsScalesSoundsVolumes = [];

  for (var i = 0; i < data.bonks[customName].barrageCount; i++)
    getImagesWeightsScalesSoundsVolumes.push(getCustomImageWeightScaleSoundVolume(customName));

  return getImagesWeightsScalesSoundsVolumes;
}

function custom(customName)
{
  console.log("Sending Custom");
  if (socket != null && (hasActiveImageCustom(customName) || hasActiveImage())) {
    const imagesWeightsScalesSoundsVolumes = getCustomImagesWeightsScalesSoundsVolumes(customName);
    var images = [], weights = [], scales = [], sounds = [], volumes = [];
    for (var i = 0; i < imagesWeightsScalesSoundsVolumes.length; i++) {
      images[i] = imagesWeightsScalesSoundsVolumes[i].location;
      weights[i] = imagesWeightsScalesSoundsVolumes[i].weight;
      scales[i] = imagesWeightsScalesSoundsVolumes[i].scale;
      sounds[i] = imagesWeightsScalesSoundsVolumes[i].sound;
      volumes[i] = imagesWeightsScalesSoundsVolumes[i].volume;
    }

    var request = {
      "type": customName,
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
  if (socket != null && connectedVTube)
  {
    calibrateStage = -1;
    calibrate();
  }
}

function nextCalibrate()
{
  if (socket != null && connectedVTube)
  {
    calibrateStage++;
    calibrate();
  }
}

function cancelCalibrate()
{
  if (socket != null && connectedVTube)
  {
    calibrateStage = 4;
    calibrate();
  }
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
  setData(arg[0], arg[1], true);
});

function setData(field, value, external)
{
  data[field] = value;
  fs.writeFileSync(__dirname + "/data.json", JSON.stringify(data));
  if (external)
    mainWindow.webContents.send("doneWriting");
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
  const reward = await apiClient.helix.channelPoints.getCustomRewardById(redemptionMessage.channelId, redemptionMessage.rewardId);
  console.log(reward.title);

  if (listeningSingle)
  {
    setData("singleRedeemID", redemptionMessage.rewardId, false);
    listeningSingle = false;
  }
  else if (listeningBarrage)
  {
    setData("barrageRedeemID", redemptionMessage.rewardId, false);
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
            images.push(data.bitBonkThrows.one.location);
            weights.push(0.2);
            scales.push(data.bitBonkThrows.one.scale);
            break;
          case 100:
            images.push(data.bitBonkThrows.oneHundred.location);
            weights.push(0.4);
            scales.push(data.bitBonkThrows.oneHundred.scale);
            break;
          case 1000:
            images.push(data.bitBonkThrows.oneThousand.location);
            weights.push(0.6);
            scales.push(data.bitBonkThrows.oneThousand.scale);
            break;
          case 5000:
            images.push(data.bitBonkThrows.fiveThousandd.location);
            weights.push(0.8);
            scales.push(data.bitBonkThrows.fiveThousandd.scale);
            break;
          case 10000:
            images.push(data.bitBonkThrows.tenThousand.location);
            weights.push(1);
            scales.push(data.bitBonkThrows.tenThousand.scale);
            break;
        }
        
        if (hasActiveBitSound())
        {
          var soundIndex;
          do {
            soundIndex = Math.floor(Math.random() * data.bitImpacts.length);
          } while (!data.bitImpacts[soundIndex].enabled);

          sounds.push(data.bitImpacts[soundIndex].location);
          volumes.push(data.bitImpacts[soundIndex].volume);
        }
        else if (hasActiveSound())
        {
          var soundIndex;
          do {
            soundIndex = Math.floor(Math.random() * data.impacts.length);
          } while (!data.impacts[soundIndex].enabled);

          sounds.push(data.impacts[soundIndex].location);
          volumes.push(data.impacts[soundIndex].volume);
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

var canRaid = true, numRaiders = 0;
async function onRaidHandler(_, raider, raidInfo)
{
  if (data.raidEnabled && canRaid)
  {
    if (data.raidCooldown > 0)
    {
      canRaid = false;
      setTimeout(() => { canRaid = true; }, data.raidCooldown * 1000);
    }

    if (raider == null)
    {
      raider = userID
      numRaiders = Math.floor(Math.random() * data.raidMaxBarrageCount);
    }
    else
    {
      numRaiders = raidInfo.viewerCount;
      raider = await apiClient.helix.users.getUserByName(raider);
      raider = raider.id;
    }
  
    if (numRaiders > data.raidMaxBarrageCount)
      numRaiders = data.raidMaxBarrageCount;
  
    mainWindow.webContents.send("raid", [ raider, token.accessToken ]);
  }
}

ipcMain.on('emotes', (event, message) => handleRaidEmotes(event, message));

function handleRaidEmotes(_, emotes)
{
  if (socket != null)
  {
    if (emotes.data.length > 0)
    {
      var images = [], weights = [], scales = [], sounds = [], volumes = [];
      for (var i = 0; i < numRaiders; i++)
      {
        images.push("https://static-cdn.jtvnw.net/emoticons/v1/" + emotes.data[Math.floor(Math.random() * emotes.data.length)].id + "/3.0");
  
        weights.push(1);
        scales.push(1);
  
        if (hasActiveSound())
        {
          var soundIndex;
          do {
            soundIndex = Math.floor(Math.random() * data.impacts.length);
          } while (!data.impacts[soundIndex].enabled);
  
          sounds.push(data.impacts[soundIndex].location);
          volumes.push(data.impacts[soundIndex].volume);
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
    else
      barrage();
  }
}

function hasActiveImage()
{
  if (data.throws == null || data.throws.length == 0)
    return false;

  var active = false;
  for (var i = 0; i < data.throws.length; i++)
  {
    if (data.throws[i].enabled)
    {
      active = true;
      break;
    }
  }
  return active;
}

function hasActiveImageCustom(customName)
{
  if (data.bonks[customName].throws == null || data.bonks[customName].throws.length == 0)
    return false;

  var active = false;
  for (var i = 0; i < data.bonks[customName].throws.length; i++)
  {
    if (data.bonks[customName].throws[i].enabled)
    {
      active = true;
      break;
    }
  }
  return active;
}

function hasActiveSound()
{
  if (data.impacts == null || data.impacts.length == 0)
    return false;

  var active = false;
  for (var i = 0; i < data.impacts.length; i++)
  {
    if (data.impacts[i].enabled)
    {
      active = true;
      break;
    }
  }
  return active;
}

function hasActiveSoundCustom(customName)
{
  if (data.bonks[customName].impacts == null || data.bonks[customName].impacts.length == 0)
    return false;

  var active = false;
  for (var i = 0; i < data.bonks[customName].impacts.length; i++)
  {
    if (data.bonks[customName].impacts[i].enabled)
    {
      active = true;
      break;
    }
  }
  return active;
}

function hasActiveBitSound()
{
  if (data.bitImpacts == null || data.bitImpacts.length == 0)
    return false;

  var active = false;
  for (var i = 0; i < data.bitImpacts.length; i++)
  {
    if (data.bitImpacts[i].enabled)
    {
      active = true;
      break;
    }
  }
  return active;
}