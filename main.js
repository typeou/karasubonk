const { app, Menu, Tray, BrowserWindow, ipcMain, session } = require("electron");
const { ApiClient } = require("@twurple/api");
const { PubSubClient } = require("@twurple/pubsub");
const { ChatClient } = require("@twurple/chat");
const { ElectronAuthProvider } = require("@twurple/auth-electron");
const fs = require("fs");

var mainWindow;

const isPrimary = app.requestSingleInstanceLock();
    
if (!isPrimary)
  app.quit()
else
{
  app.on("second-instance", () => {
    if (mainWindow)
    {
      if (mainWindow.isMinimized())
        mainWindow.restore();
      mainWindow.focus();
    }
  })
}

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
    if (data.minimizeToTray)
    {
      setTray();
      mainWindow.setSkipTaskbar(true);
    }
    else
    {
      if (tray != null)
      {
        setTimeout(() => {
          tray.destroy()
        }, 100);
      }

      mainWindow.setSkipTaskbar(false);
    }
  });

  mainWindow.on("restore", () => {
    if (tray != null)
    {
      setTimeout(() => {
        tray.destroy()
      }, 100);
    }

    mainWindow.setSkipTaskbar(false);
  });

  mainWindow.on("close", () => {
    exiting = true;
  });
}

function setTray()
{
  tray = new Tray(__dirname + "/icon.ico");
  contextMenu = Menu.buildFromTemplate([
    { label: "Open", click: () => { mainWindow.restore(); } },
    { label: "Quit", role: "quit" }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => { mainWindow.restore(); });
}

var tray = null, contextMenu;
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
});

// --------------
// Authentication
// --------------

var authProvider, token, apiClient, chatClient, userID, authenticated = false, authenticating = false, listenersActive = false;

// Retry authorization every second
setInterval(() => {
  if (!authenticated && !authenticating)
    authenticate();
}, 1000);

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
    loggedOut = false;
    authenticated = true;
    apiClient = new ApiClient({ authProvider });
    var tokenInfo = await apiClient.getTokenInfo();
    mainWindow.webContents.send("username", tokenInfo.userName);
    pubSub(apiClient);
  }

  authenticating = false;
}

ipcMain.on("reauthenticate", async () => {
  if (authProvider != null)
  {
    // Clear cookies to allow reauthentication
    session.defaultSession.clearStorageData([], () => {});
    authProvider.allowUserChange();
    authenticated = false;
    authenticating = false;
    removeListeners();
  }
});

var pubSubListeners = [], chatListeners = [];

// Event listeners
async function pubSub(apiClient) {
  const pubSubClient = new PubSubClient();
  userID = await pubSubClient.registerUserListener(authProvider);

  // PubSub Event Listeners
  if (authenticated)
  {
    console.log("Listening to Redemptions");
    pubSubListeners.push(await pubSubClient.onRedemption(userID, onRedeemHandler));
  }
  else
    removeListeners();

  if (authenticated)
  {
    console.log("Listening to Subs");
    pubSubListeners.push(await pubSubClient.onSubscription(userID, onSubHandler));
  }
  else
    removeListeners();

  if (authenticated)
  {
    console.log("Listening to Bits");
    pubSubListeners.push(await pubSubClient.onBits(userID, onBitsHandler));
  }
  else
    removeListeners();

  const user = await apiClient.helix.users.getUserById(userID);
  chatClient = new ChatClient({ authProvider, channels: [user.name] });
  await chatClient.connect();

  // Chat Event Listeners
  if (authenticated)
  {
    console.log("Listening to Messages");
    chatListeners.push(chatClient.onMessage(onMessageHandler));
  }
  else
    removeListeners();
  
  if (authenticated)
  {
    console.log("Listening to Raids");
    chatListeners.push(chatClient.onRaid(onRaidHandler));
  }
  else
    removeListeners();

  // Done enabling listeners
  if (pubSubListeners.length > 0 || chatListeners.length > 0)
    listenersActive = true;
}

function removeListeners()
{
  for (var i = 0; i < pubSubListeners.length; i++)
    pubSubListeners[i].remove();
  pubSubListeners = [];
  for (var i = 0; i < chatListeners.length; i++)
    chatClient.removeListener(chatListeners[i]);
  chatListeners = [];
  listenersActive = false;
}

// Periodically reporting status back to renderer
var exiting = false;
setInterval(() => {
  if (mainWindow != null)
  {
    var status = 0;
    if (portInUse)
      status = 9;
    else if (!authenticated)
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


ipcMain.on("help", () => require('electron').shell.openExternal("https://typeou.dev/#kbonkHelp"));
ipcMain.on("link", () => require('electron').shell.openExternal("https://typeou.itch.io/karasubonk"));

// ----------------
// Websocket Server
// ----------------

const WebSocket = require("ws");

var wss, portInUse = false, socket, connectedVTube = false;

createServer();

function createServer()
{
  portInUse = false;

  wss = new WebSocket.Server({ port: data.portThrower });

  wss.on("error", () => {
    portInUse = true;
    // Retry server creation after 3 seconds
    setTimeout(() => {
      createServer();
    }, 3000);
  });

  if (!portInUse)
  {
    wss.on("connection", function connection(ws)
    {
      portInUse = false;
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
        else if (request.type == "setAuthVTS")
        {
          setData("authVTS", request.token);
          var request = {
              "type": "getAuthVTS",
              "token": request.token
          }
          socket.send(JSON.stringify(request));
        }
        else if (request.type == "getAuthVTS")
        {
          var request = {
              "type": "getAuthVTS",
              "token": data.authVTS
          }
          socket.send(JSON.stringify(request));
        }
      });
    
      ws.on("close", function message()
      {
        socket = null;
        calibrateStage = -2;
      });
    });
  }
}

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
function getImagesWeightsScalesSoundsVolumes(customAmount)
{
  var getImagesWeightsScalesSoundsVolumes = [];

  var count = customAmount == null ? data.barrageCount : customAmount;
  for (var i = 0; i < count; i++)
    getImagesWeightsScalesSoundsVolumes.push(getImageWeightScaleSoundVolume());

  return getImagesWeightsScalesSoundsVolumes;
}

// Test Events
ipcMain.on("single", () => single());
ipcMain.on("barrage", () => barrage());
ipcMain.on("sub", () => onSubHandler({ isGift: false }));
ipcMain.on("subGift", () => onSubHandler({ isGift: true }));
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
function barrage(customAmount)
{
  console.log("Sending Barrage");
  if (socket != null && hasActiveImage()) {
    const imagesWeightsScalesSoundsVolumes = getImagesWeightsScalesSoundsVolumes(customAmount);
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

ipcMain.on("testCustomBonk", (_, message) => { custom(message); });

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
            custom(data.commands[i].bonkType);
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
    switch (data.subType)
    {
      case "single":
        single();
        break;
      case "barrage":
        barrage();
        break;
      default:
        custom(data.subType);
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
    switch (data.subGiftType)
    {

      case "single":
        single();
        break;
      case "barrage":
        barrage();
        break;
      default:
        custom(data.subGiftType);
        break;
    }

    if (data.subGiftCooldown > 0)
    {
      canSubGift = false;
      setTimeout(() => { canSubGift = true; }, data.subGiftCooldown * 1000);
    }
  }
}

const bitTiers = [ 100, 1000, 5000, 10000 ];

var canBits = true;
function onBitsHandler(bitsMessage)
{
  if (bitsMessage == null || canBits && data.bitsEnabled && bitsMessage.bits >= data.bitsMinDonation) {
    if (bitsMessage != null && data.bitsCooldown > 0)
    {
      canBits = false;
      setTimeout(() => { canBits = true; }, data.bitsCooldown * 1000);
    }

    var totalBits = bitsMessage == null ? bitTiers[Math.floor(Math.random() * bitTiers.length)] : bitsMessage.bits;

    var numBits = [0, 0, 0, 0], canAdd = true;
    while (!data.bitsOnlySingle && totalBits >= 100 && totalBits + numBits[0] + numBits[1] + numBits[2] + numBits[3] > data.bitsMaxBarrageCount && canAdd)
    {
      canAdd = false;
      for (var i = bitTiers.length - 1; i >= 0; i--)
      {
        var max = totalBits / bitTiers[i];
        if (max > 1)
        {
          max--;
          canAdd = true;
          numBits[i]++;
          totalBits -= bitTiers[i];
        }
        var temp = Math.floor(Math.random() * max);
        numBits[i] += temp;
        totalBits -= temp * bitTiers[i];
      }
    }

    if (totalBits + numBits[0] + numBits[1] + numBits[2] + numBits[3] > data.bitsMaxBarrageCount)
      totalBits = data.bitsMaxBarrageCount - (numBits[0] + numBits[1] + numBits[2] + numBits[3]);

    var bitThrows = [];
    for (var i = 0; i < bitTiers.length; i++)
    {
      while (bitThrows.length < data.bitsMaxBarrageCount && numBits[i]-- > 0)
        bitThrows.push(bitTiers[i]);
    }
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
      numRaiders = data.raidMinBarrageCount + Math.floor(Math.random() * (data.raidMaxBarrageCount - data.raidMinBarrageCount));
    }
    else
    {
      numRaiders = raidInfo.viewerCount;
      raider = await apiClient.helix.users.getUserByName(raider);
      raider = raider.id;
    }

    if (numRaiders >= data.raidMinRaiders)
    {
      if (numRaiders < data.raidMinBarrageCount)
        numRaiders = data.raidMinBarrageCount;
    
      if (numRaiders > data.raidMaxBarrageCount)
        numRaiders = data.raidMaxBarrageCount;
    
      if (data.raidEmotes)
        mainWindow.webContents.send("raid", [ raider, token.accessToken ]);
      else
        barrage(numRaiders);
    }
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
      barrage(numRaiders);
  }
}
