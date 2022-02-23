const { app, Menu, Tray, BrowserWindow, ipcMain } = require("electron");
const { ApiClient } = require("@twurple/api");
const { PubSubClient } = require("@twurple/pubsub");
const { ChatClient } = require("@twurple/chat");
const { ElectronAuthProvider } = require("@twurple/auth-electron");
const fs = require("fs");

var mainWindow;
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    icon: __dirname + "/icon.ico",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    autoHideMenuBar: true,
    useContentSize: true
  })
  
  mainWindow.loadFile("index.html")

  // Minimizing to and restoring from tray
  mainWindow.on("minimize", () => {
    mainWindow.setSkipTaskbar(true)
  });

  mainWindow.on("restore", () => {
    mainWindow.setSkipTaskbar(false)
  });
}

var tray = null;
app.whenReady().then(() => {
  tray = new Tray(__dirname + "/icon.ico");
  var contextMenu = Menu.buildFromTemplate([
    { label: "Open", click: () => { mainWindow.restore(); } },
    { label: "Quit", role: "quit" }
  ]);
  tray.setContextMenu(contextMenu)
  tray.on("click", () => { mainWindow.restore(); });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
});

app.on("window-all-closed", () => {
  exiting = true;
  if (process.platform !== "darwin") app.quit()
});

// --------------
// Authentication
// --------------

var authProvider, token, apiClient, chatClient, userID, authenticated = false, authenticating = false, listenersActive = false;

// Retry authorization every 3 seconds
setInterval(() => {
  if (!authenticated && !authenticating)
    authenticate();
}, 3000);

// Attempt authorization
async function authenticate() {
  const clientId = "u4rwa52hwkkgyoyow0t3gywxyv54pg";
  const redirectUri = "https://twitchapps.com/tokengen/&scope=chat%3Aread%20chat%3Aedit%20channel%3Aread%3Aredemptions%20channel_subscriptions%20bits%3Aread";

  // Prevent retrying authentication while signing in
  authenticating = true;
  authProvider = new ElectronAuthProvider({ clientId, redirectUri });

  // Ensure token was successfully acquired
  token = await authProvider.getAccessToken();
  if (token != null)
  {
    authenticated = true;
    apiClient = new ApiClient({ authProvider });
    pubSub(apiClient);
  }

  authenticating = false;
}

// Event listeners
async function pubSub(apiClient) {
  const pubSubClient = new PubSubClient();
  userID = await pubSubClient.registerUserListener(authProvider);

  // PubSub Event Listeners
  console.log("Listening to Redemptions");
  await pubSubClient.onRedemption(userID, onRedeemHandler);
  console.log("Listening to Subs");
  await pubSubClient.onSubscription(userID, onSubHandler);
  console.log("Listening to Bits");
  await pubSubClient.onBits(userID, onBitsHandler);

  const user = await apiClient.helix.users.getUserById(userID);
  chatClient = new ChatClient({ authProvider, channels: [user.name] });
  await chatClient.connect();

  // Chat Event Listeners
  console.log("Listening to Messages");
  chatClient.onMessage(onMessageHandler);
  console.log("Listening to Raids");
  chatClient.onRaid(onRaidHandler);

  // Done enabling listeners
  listenersActive = true;
}

// Periodically reporting status back to renderer
var exiting = false;
setInterval(() => {
  if (mainWindow != null)
  {
    var status = 0;
    if (!authenticated)
      status = 1;
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
    else if (listening)
      status = 6;
    else if (calibrateStage == -1)
      status = 7;
  
    if (!exiting)
      mainWindow.webContents.send("status", status);
  }
}, 100);

// Loading data from file
// If no data exists, create data from default data file
const defaultData = JSON.parse(fs.readFileSync(__dirname + "/defaultData.json", "utf8"));
if (!fs.existsSync(__dirname + "/data.json"))
  fs.writeFileSync(__dirname + "/data.json", JSON.stringify(defaultData));
var data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));

// ----------------
// Websocket Server
// ----------------

const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: data.portThrower });

var socket, connectedVTube = false;

wss.on("connection", function connection(ws)
{
  socket = ws;
  
  socket.on("message", function message(request)
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

  ws.on("close", function message()
  {
    socket = null;
  });
});

// -----------------
// Model Calibration
// -----------------

ipcMain.on("startCalibrate", () => startCalibrate());
ipcMain.on("nextCalibrate", () => nextCalibrate());
ipcMain.on("cancelCalibrate", () => cancelCalibrate());

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

// -----
// Bonks
// -----

// Acquire a random image, sound, and associated properties
function getImageWeightScaleSoundVolume()
{
  var index;
  do {
    index = Math.floor(Math.random() * data.throws.length);
  } while (!data.throws[index].enabled);

  var soundIndex = -1;
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
    "sound": data.throws[index].sound != null ? data.throws[index].sound : soundIndex != -1 ? data.impacts[soundIndex].location : null,
    "volume": data.throws[index].volume * (soundIndex != -1 ? data.impacts[soundIndex].volume : 1)
  };
}

// Acquire a set of images, sounds, and associated properties for a default barrage
function getImagesWeightsScalesSoundsVolumes()
{
  var getImagesWeightsScalesSoundsVolumes = [];

  for (var i = 0; i < data.barrageCount; i++)
    getImagesWeightsScalesSoundsVolumes.push(getImageWeightScaleSoundVolume());

  return getImagesWeightsScalesSoundsVolumes;
}

// Test Events
ipcMain.on("single", () => single());
ipcMain.on("barrage", () => barrage());
ipcMain.on("bits", () => onBitsHandler());
ipcMain.on("raid", () => onRaidHandler());

// Testing a specific item
ipcMain.on("testItem", (event, message) => testItem(event, message));

function testItem(_, item)
{
  console.log("Testing Item");
  if (socket != null)
  {
    var soundIndex = -1;
    if (hasActiveSound())
    {
      do {
        soundIndex = Math.floor(Math.random() * data.impacts.length);
      } while (!data.impacts[soundIndex].enabled);
    }
    
    var request =
    {
      "type": "single",
      "image": item.location,
      "weight": item.weight,
      "scale": item.scale,
      "sound": item.sound == null && soundIndex != -1 ? data.impacts[soundIndex].location : item.sound,
      "volume": item.volume,
      "data": data
    }
    socket.send(JSON.stringify(request));
  }
}

// A single random bonk
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

// A random barrage of bonks
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

// Acquire an image, sound, and associated properties for a custom bonk
function getCustomImageWeightScaleSoundVolume(customName)
{
  var index;
  if (data.customBonks[customName].itemsOverride && hasActiveImageCustom(customName))
  {
    do {
      index = Math.floor(Math.random() * data.throws.length);
    } while (!data.throws[index].customs.includes(customName));
  }
  else
  {
    do {
      index = Math.floor(Math.random() * data.throws.length);
    } while (!data.throws[index].enabled);
  }

  var soundIndex = -1;
  if (data.customBonks[customName].soundsOverride && hasActiveSoundCustom(customName))
  {
    do {
      soundIndex = Math.floor(Math.random() * data.impacts.length);
    } while (!data.impacts[soundIndex].customs.includes(customName));
  }
  else if (hasActiveSound())
  {
    do {
      soundIndex = Math.floor(Math.random() * data.impacts.length);
    } while (!data.impacts[soundIndex].enabled);
  }

  var impactDecalIndex = -1;
  if (hasActiveImpactDecal(customName))
  {
    do {
      impactDecalIndex = Math.floor(Math.random() * data.customBonks[customName].impactDecals.length);
    } while (!data.customBonks[customName].impactDecals[impactDecalIndex].enabled);
  }

  var windupSoundIndex = -1;
  if (hasActiveWindupSound(customName))
  {
    do {
      windupSoundIndex = Math.floor(Math.random() * data.customBonks[customName].windupSounds.length);
    } while (!data.customBonks[customName].windupSounds[windupSoundIndex].enabled);
  }

  return {
    "location": data.throws[index].location,
    "weight": data.throws[index].weight,
    "scale": data.throws[index].scale,
    "sound": data.throws[index].sound != null ? data.throws[index].sound : (soundIndex != -1 ? data.impacts[soundIndex].location : null),
    "volume": data.throws[index].volume * (soundIndex != -1 ? data.impacts[soundIndex].volume : 1),
    "impactDecal": impactDecalIndex != -1 ? data.customBonks[customName].impactDecals[impactDecalIndex] : null,
    "windupSound": windupSoundIndex != -1 ? data.customBonks[customName].windupSounds[windupSoundIndex] : null
  };
}

// Acquire a set of images, sounds, and associated properties for a custom bonk
function getCustomImagesWeightsScalesSoundsVolumes(customName)
{
  var getImagesWeightsScalesSoundsVolumes = [];

  for (var i = 0; i < data.customBonks[customName].barrageCount; i++)
    getImagesWeightsScalesSoundsVolumes.push(getCustomImageWeightScaleSoundVolume(customName));

  return getImagesWeightsScalesSoundsVolumes;
}

ipcMain.on("testCustomBonk", (_, message) => custom(message));

// A custom bonk test
function custom(customName)
{
  console.log("Sending Custom");
  if (socket != null && hasActiveImageCustom(customName)) {
    const imagesWeightsScalesSoundsVolumes = getCustomImagesWeightsScalesSoundsVolumes(customName);
    var images = [], weights = [], scales = [], sounds = [], volumes = [], impactDecals = [], windupSounds = [];
    for (var i = 0; i < imagesWeightsScalesSoundsVolumes.length; i++) {
      images[i] = imagesWeightsScalesSoundsVolumes[i].location;
      weights[i] = imagesWeightsScalesSoundsVolumes[i].weight;
      scales[i] = imagesWeightsScalesSoundsVolumes[i].scale;
      sounds[i] = imagesWeightsScalesSoundsVolumes[i].sound;
      volumes[i] = imagesWeightsScalesSoundsVolumes[i].volume;
      impactDecals[i] = imagesWeightsScalesSoundsVolumes[i].impactDecal;
      windupSounds[i] = imagesWeightsScalesSoundsVolumes[i].windupSound;
    }

    var request = {
      "type": customName,
      "image": images,
      "weight": weights,
      "scale": scales,
      "sound": sounds,
      "volume": volumes,
      "impactDecal": impactDecals,
      "windupSound": windupSounds,
      "data": data
    }
    socket.send(JSON.stringify(request));
  }
}

// ----
// Data
// ----

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
  if (!data.customBonks[customName].itemsOverride)
    return hasActiveImage();

  if (data.throws == null || data.throws.length == 0)
    return false;

  var active = false;
  for (var i = 0; i < data.throws.length; i++)
  {
    if (data.throws[i].customs.includes(customName))
    {
      active = true;
      break;
    }
  }
  return active;
}

function hasActiveImpactDecal(customName)
{
  if (data.customBonks[customName].impactDecals == null || data.customBonks[customName].impactDecals.length == 0)
    return false;

  var active = false;
  for (var i = 0; i < data.customBonks[customName].impactDecals.length; i++)
  {
    if (data.customBonks[customName].impactDecals[i].enabled)
    {
      active = true;
      break;
    }
  }
  return active;
}

function hasActiveWindupSound(customName)
{
  if (data.customBonks[customName].windupSounds == null || data.customBonks[customName].windupSounds.length == 0)
    return false;

  var active = false;
  for (var i = 0; i < data.customBonks[customName].windupSounds.length; i++)
  {
    if (data.customBonks[customName].windupSounds[i].enabled)
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
  if (!data.customBonks[customName].soundsOverride)
    return hasActiveSound();

  if (data.impacts == null || data.impacts.length == 0)
    return false;

  var active = false;
  for (var i = 0; i < data.impacts.length; i++)
  {
    if (data.impacts[i].customs.includes(customName))
    {
      active = true;
      break;
    }
  }
  return active;
}

function hasActiveBitSound()
{
  if (data.impacts == null || data.impacts.length == 0)
    return false;

  var active = false;
  for (var i = 0; i < data.impacts.length; i++)
  {
    if (data.impacts[i].bits)
    {
      active = true;
      break;
    }
  }
  return active;
}

// --------------
// Event Handlers
// --------------

var commandCooldowns = {};
function onMessageHandler(_, _, message)
{
  console.log("Received Message");

  if (data.commands != null)
  {
    for (var i = 0; i < data.commands.length; i++)
    {
      if (data.commands[i].name != "" && data.commands[i].name.toLowerCase() == message.toLowerCase() && commandCooldowns[data.commands[i].name.toLowerCase()] == null)
      {
        switch (data.commands[i].bonkType)
        {
          case "single":
            single();
            break;
          case "barrage":
            barrage();
            break;
          default:
            custom(data.redeems[i].bonkType);
            break;
        }

        commandCooldowns[data.commands[i].name.toLowerCase()] = true;
        setTimeout(() => { delete commandCooldowns[data.commands[i].name.toLowerCase()]; }, data.commands[i].cooldown * 1000);
        break;
      }
    }
  }
}

ipcMain.on("listenRedeemStart", () => { listening = true; });
ipcMain.on("listenRedeemCancel", () => { listening = false; });

var listening = false;
async function onRedeemHandler(redemptionMessage)
{
  const reward = await apiClient.helix.channelPoints.getCustomRewardById(redemptionMessage.channelId, redemptionMessage.rewardId);

  if (listening)
  {
    mainWindow.webContents.send("redeemData", [ redemptionMessage.rewardId, reward.title ] );
    listening = false;
  }
  else if (data.redeems != null)
  {
    for (var i = 0; i < data.redeems.length; i++)
    {
      if (data.redeems[i].id == redemptionMessage.rewardId)
      {
        switch (data.redeems[i].bonkType)
        {
          case "single":
            single();
            break;
          case "barrage":
            barrage();
            break;
          default:
            custom(data.redeems[i].bonkType);
            break;
        }

        break;
      }
    }
  }
}

var canSub = true, canSubGift = true;
function onSubHandler(subMessage)
{
  if (canSub && data.subEnabled && !subMessage.isGift)
  {
    switch (data.subBonkType)
    {
      case "single":
        single();
        break;
      case "barrage":
        barrage();
        break;
      default:
        custom(data.subBonkType);
        break;
    }

    if (data.subCooldown > 0)
    {
      canSub = false;
      setTimeout(() => { canSub = true; }, data.subCooldown * 1000);
    }
  }
  else if (canSubGift && data.subGiftEnabled && subMessage.isGift)
  {
    switch (data.subGiftBonkType)
    {

      case "single":
        single();
        break;
      case "barrage":
        barrage();
        break;
      default:
        custom(data.subGiftBonkType);
        break;
    }

    if (data.subGiftCooldown > 0)
    {
      canSubGift = false;
      setTimeout(() => { canSubGift = true; }, data.subGiftCooldown * 1000);
    }
  }
}

var canBits = true;
function onBitsHandler(bitsMessage)
{
  if (bitsMessage == null || canBits && data.bitsEnabled) {
    if (bitsMessage != null && data.bitsCooldown > 0)
    {
      canBits = false;
      setTimeout(() => { canBits = true; }, data.bitsCooldown * 1000);
    }

    var totalBits = bitsMessage == null ? Math.floor(Math.random() * 15000) : bitsMessage.bits;

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
            images.push(data.bitThrows.one.location);
            weights.push(0.2);
            scales.push(data.bitThrows.one.scale);
            break;
          case 100:
            images.push(data.bitThrows.oneHundred.location);
            weights.push(0.4);
            scales.push(data.bitThrows.oneHundred.scale);
            break;
          case 1000:
            images.push(data.bitThrows.oneThousand.location);
            weights.push(0.6);
            scales.push(data.bitThrows.oneThousand.scale);
            break;
          case 5000:
            images.push(data.bitThrows.fiveThousand.location);
            weights.push(0.8);
            scales.push(data.bitThrows.fiveThousand.scale);
            break;
          case 10000:
            images.push(data.bitThrows.tenThousand.location);
            weights.push(1);
            scales.push(data.bitThrows.tenThousand.scale);
            break;
        }
        
        if (hasActiveBitSound())
        {
          var soundIndex;
          do {
            soundIndex = Math.floor(Math.random() * data.impacts.length);
          } while (!data.impacts[soundIndex].bits);

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
    if (raider != null && data.raidCooldown > 0)
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

ipcMain.on("emotes", (event, message) => handleRaidEmotes(event, message));

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
