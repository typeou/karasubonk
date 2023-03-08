// Karasubot Websocket Scripts
const version = 1.20;

var socketKarasu, karasuIsOpen = false;
var isCalibrating = false;

var previousModelPosition = {
    "positionX": 0,
    "positionY": 0,
    "rotation": 0,
    "size": 0
};
function endCalibration()
{
    if (isCalibrating)
    {
        isCalibrating = false;
        document.querySelector("#guide").hidden = true;
        document.querySelector("#guideText").hidden = true;
        if (vTubeIsOpen)
        {
            var request = {
                "apiName": "VTubeStudioPublicAPI",
                "apiVersion": "1.0",
                "requestID": "9",
                "messageType": "MoveModelRequest",
                "data": {
                    "timeInSeconds": 0.5,
                    "valuesAreRelativeToModel": false,
                    "positionX": previousModelPosition.positionX,
                    "positionY": previousModelPosition.positionY,
                    "rotation": previousModelPosition.rotation,
                    "size": previousModelPosition.size
                }
            }
            socketVTube.onmessage = null;
            socketVTube.send(JSON.stringify(request));
        }
    }
}

var guideX = null, guideY = null;
document.onclick = function(e)
{
    guideX = e.clientX;
    guideY = e.clientY;
    document.querySelector("#guide").style.left = (guideX - 25) + "px";
    document.querySelector("#guide").style.top = (guideY - 25) + "px";
}

var badVersion = false, mainVersion;
function tryWarnVersion()
{
    document.querySelector("#mainVersion").innerHTML = mainVersion;
    document.querySelector("#bonkerVersion").innerHTML = version;
    document.querySelector("#warnVersion").hidden = !badVersion;
}

function connectKarasu()
{
    socketKarasu = new WebSocket("ws://localhost:" + ports[0]);
    socketKarasu.onopen = function()
    {
        karasuIsOpen = true;
        console.log("Connected to Karasubot!");

        // Stop attempting to reconnect unless we lose connection
        clearInterval(tryConnectKarasu);
        tryConnectKarasu = setInterval(function()
        {
            if (socketKarasu.readyState != 1)
            {
                karasuIsOpen = false;
                console.log("Lost connection to Karasubot!");
                endCalibration();
                clearInterval(tryConnectKarasu);
                tryConnectKarasu = setInterval(retryConnectKarasu, 1000 * 3);
            }
        }, 1000 * 3);
    };
    // Process incoming requests
    socketKarasu.onmessage = function(event)
    {
        var data = JSON.parse(event.data);

        if (data.type == "versionReport")
        {
            mainVersion = parseFloat(data.version);
            badVersion = mainVersion != version;
            tryWarnVersion();
            socketKarasu.send(JSON.stringify({
                "type": "versionReport",
                "version": version
            }));
        }
        else if (data.type == "calibrating")
        {
            if (guideX == null)
                guideX = window.innerWidth / 2;
            if (guideY == null)
                guideY = window.innerHeight / 2;
            if (data.stage >= 0 && data.stage != 4)
            {
                document.querySelector("#guide").hidden = false;
                document.querySelector("#guideText").hidden = false;
            }
            else
            {
                document.querySelector("#guide").hidden = true;
                document.querySelector("#guideText").hidden = true;
            }
            switch(data.stage)
            {
                // Stage -1 is storing current position information
                case -1:
                    var request = {
                        "apiName": "VTubeStudioPublicAPI",
                        "apiVersion": "1.0",
                        "requestID": "11",
                        "messageType": "CurrentModelRequest"
                    }
                    socketVTube.onmessage = function(event)
                    {
                        socketVTube.onmessage = null;
                        const modelPosition = JSON.parse(event.data).data.modelPosition;
                        previousModelPosition = {
                            "positionX": modelPosition.positionX,
                            "positionY": modelPosition.positionY,
                            "rotation": modelPosition.rotation,
                            "size": modelPosition.size
                        }
                    }
                    socketVTube.send(JSON.stringify(request));
                    break;
                // Stage 0 is calibrating at smallest size
                case 0:
                    isCalibrating = true;

                    var request = {
                        "apiName": "VTubeStudioPublicAPI",
                        "apiVersion": "1.0",
                        "requestID": "7",
                        "messageType": "MoveModelRequest",
                        "data": {
                            "timeInSeconds": 0.5,
                            "valuesAreRelativeToModel": false,
                            "rotation": 0,
                            "size": -100
                        }
                    }
                    socketVTube.onmessage = null;
                    socketVTube.send(JSON.stringify(request));
                    break;
                // Stage 1 is sending min size position information back
                case 1:
                    var request = {
                        "apiName": "VTubeStudioPublicAPI",
                        "apiVersion": "1.0",
                        "requestID": "8",
                        "messageType": "CurrentModelRequest"
                    }
                    socketVTube.onmessage = function(event)
                    {
                        const tempData = JSON.parse(event.data).data;
                        request = {
                            "type": "calibrating",
                            "stage": "min",
                            "positionX": tempData.modelPosition.positionX - (((guideX / window.innerWidth) * 2) - 1),
                            "positionY": tempData.modelPosition.positionY + (((guideY / window.innerHeight) * 2) - 1),
                            "size": tempData.modelPosition.size,
                            "modelID": tempData.modelID
                        }
                        socketVTube.onmessage = null;
                        socketKarasu.send(JSON.stringify(request));
                    }
                    socketVTube.send(JSON.stringify(request));
                    break;
                // Stage 2 is calibrating at largest size
                case 2:
                    var request = {
                        "apiName": "VTubeStudioPublicAPI",
                        "apiVersion": "1.0",
                        "requestID": "9",
                        "messageType": "MoveModelRequest",
                        "data": {
                            "timeInSeconds": 0.5,
                            "valuesAreRelativeToModel": false,
                            "rotation": 0,
                            "size": 100
                        }
                    }
                    socketVTube.onmessage = null;
                    socketVTube.send(JSON.stringify(request));
                    break;
                // Stage 3 is sending max size position information back
                case 3:
                    var request = {
                        "apiName": "VTubeStudioPublicAPI",
                        "apiVersion": "1.0",
                        "requestID": "10",
                        "messageType": "CurrentModelRequest"
                    }
                    socketVTube.onmessage = function(event)
                    {
                        const tempData = JSON.parse(event.data).data;
                        request = {
                            "type": "calibrating",
                            "stage": "max",
                            "positionX": tempData.modelPosition.positionX - (((guideX / window.innerWidth) * 2) - 1),
                            "positionY": tempData.modelPosition.positionY + (((guideY / window.innerHeight) * 2) - 1),
                            "size": tempData.modelPosition.size,
                            "modelID": tempData.modelID
                        }
                        socketVTube.onmessage = null;
                        socketKarasu.send(JSON.stringify(request));
                    }
                    socketVTube.send(JSON.stringify(request));
                    break;
                // Stage 4 is finishing calibration
                case 4:
                    endCalibration();
                    break;
            }
        }
        else if (data.type == "getAuthVTS")
        {
            if (data.token == null)
            {
                console.log("Null Token");
                failedAuth = true;
                tryAuthorization();
            }
            else
            {
                var request = {
                    "apiName": "VTubeStudioPublicAPI",
                    "apiVersion": "1.0",
                    "requestID": "1",
                    "messageType": "AuthenticationRequest",
                    "data": {
                        "pluginName": "KBonk", 
                        "pluginDeveloper": "typeou.dev",
                        "authenticationToken": data.token
                    }
                }
                socketVTube.onmessage = function(event)
                {
                    socketVTube.onmessage = null;
                    response = JSON.parse(event.data);
                    if (response.data.authenticated)
                    {
                        console.log("Authenticated");
                        vTubeIsOpen = true;
                    }
                    else
                    {
                        console.log("Invalid Token");
                        failedAuth = true;
                        tryAuthorization();
                    }
                }
                socketVTube.send(JSON.stringify(request));
            }
        }
        else if (!isCalibrating && vTubeIsOpen)
        {
            var request = {
                "apiName": "VTubeStudioPublicAPI",
                "apiVersion": "1.0",
                "requestID": "3",
                "messageType": "InputParameterListRequest"
            }
            socketVTube.onmessage = async function(event)
            {
                const tempData = JSON.parse(event.data).data;
                const paramInfo = tempData.defaultParameters;
                const modelID = tempData.modelID;
                
                const faceWidthMin = data.data[modelID + "Min"] == null ? 0 : data.data[modelID + "Min"][0];
                const faceHeightMin = data.data[modelID + "Min"] == null ? 0 : data.data[modelID + "Min"][1];
                const faceWidthMax = data.data[modelID + "Max"] == null ? 0 : data.data[modelID + "Max"][0];
                const faceHeightMax = data.data[modelID + "Max"] == null ? 0 : data.data[modelID + "Max"][1];

                data.data.parametersHorizontal = [];
                for (var i = 0; i < parametersH.length; i++)
                {
                    var value = 0, min = -30, max = 30;
                    for (var j = 0; j < paramInfo.length; j++)
                    {
                        if (paramInfo[j].name == parametersH[i])
                        {
                            value = paramInfo[j].value;
                            min = paramInfo[j].min;
                            max = paramInfo[j].max;
                            break;
                        }
                    }
                    data.data.parametersHorizontal[i] = [ parametersH[i], value, min, max ];
                }

                data.data.parametersVertical = [];
                for (var i = 0; i < parametersV.length; i++)
                {
                    var value = 0, min = -30, max = 30;
                    for (var j = 0; j < paramInfo.length; j++)
                    {
                        if (paramInfo[j].name == parametersV[i])
                        {
                            value = paramInfo[j].value;
                            min = paramInfo[j].min;
                            max = paramInfo[j].max;
                            break;
                        }
                    }
                    data.data.parametersVertical[i] = [ parametersV[i], value, min, max ];
                }

                data.data.parametersEyes = [];
                for (var i = 0; i < parametersE.length; i++)
                {
                    var value = 0, min = 0, max = 1;
                    for (var j = 0; j < paramInfo.length; j++)
                    {
                        if (paramInfo[j].name == parametersE[i])
                        {
                            min = paramInfo[j].min;
                            max = paramInfo[j].max;
                            break;
                        }
                    }
                    data.data.parametersEyes[i] = [ parametersE[i], Math.abs(max - min) ];
                }

                console.log("Received " + data.type);

                switch(data.type)
                {
                    case "single":
                        bonk(data.image, data.weight, data.scale, data.sound, data.volume, data.data, faceWidthMin, faceWidthMax, faceHeightMin, faceHeightMax, null);
                        break;
                    case "barrage":
                        var i = 0;
                        const images = data.image;
                        const weights = data.weight;
                        const scales = data.scale;
                        const sounds = data.sound;
                        const volumes = data.volume;
                        const max = Math.min(images.length, sounds.length, weights.length);

                        bonk(images[i], weights[i], scales[i], sounds[i], volumes[i], data.data, faceWidthMin, faceWidthMax, faceHeightMin, faceHeightMax, null);
                        i++;
                        if (i < max)
                        {
                            var bonker = setInterval(function()
                            {
                                bonk(images[i], weights[i], scales[i], sounds[i], volumes[i], data.data, faceWidthMin, faceWidthMax, faceHeightMin, faceHeightMax, null);
                                if (++i >= max)
                                    clearInterval(bonker);
                            }, data.data.barrageFrequency * 1000);
                        }
                        break;
                    default:
                        if (data.data.customBonks[data.type].barrageCountOverride)
                            data.data.barrageCount = data.data.customBonks[data.type].barrageCount;
                        if (data.data.customBonks[data.type].barrageFrequencyOverride)
                            data.data.barrageFrequency = data.data.customBonks[data.type].barrageFrequency;
                        if (data.data.customBonks[data.type].throwDurationOverride)
                            data.data.throwDuration = data.data.customBonks[data.type].throwDuration;
                        if (data.data.customBonks[data.type].throwAngleOverride)
                        {
                            data.data.throwAngleMin = data.data.customBonks[data.type].throwAngleMin;
                            data.data.throwAngleMax = data.data.customBonks[data.type].throwAngleMax;
                        }
                        if (data.data.customBonks[data.type].spinSpeedOverride)
                        {
                            data.data.spinSpeedMin = data.data.customBonks[data.type].spinSpeedMin;
                            data.data.spinSpeedMax = data.data.customBonks[data.type].spinSpeedMax;
                        }

                        var i = 0;
                        const cImages = data.image;
                        const cWeights = data.weight;
                        const cScales = data.scale;
                        const cSounds = data.sound;
                        const cVolumes = data.volume;
                        const cImpactDecals = data.impactDecal;
                        var windupSound = data.windupSound[0];
                        const cMax = Math.min(cImages.length, cSounds.length, cWeights.length, cImpactDecals.length);

                        var windup, canPlayWindup;
                        if (windupSound != null)
                        {
                            windup = new Audio();
                            windup.src = windupSound.location.substr(0, windupSound.location.indexOf("/") + 1) + encodeURIComponent(windupSound.location.substr(windupSound.location.indexOf("/") + 1));
                            windup.volume = windupSound.volume * data.data.volume;
                            canPlayWindup = false;
                            windup.oncanplaythrough = function() { canPlayWindup = true; }
                        }
                        else
                            canPlayWindup = true;

                        while (!canPlayWindup)
                            await new Promise(resolve => setTimeout(resolve, 10));
                            
                        if (windupSound != null)
                            windup.play();
                            
                        setTimeout(() => {
                            bonk(cImages[i], cWeights[i], cScales[i], cSounds[i], cVolumes[i], data.data, faceWidthMin, faceWidthMax, faceHeightMin, faceHeightMax, cImpactDecals[i]);
                            i++;
                            if (i < cMax)
                            {
                                var bonker = setInterval(function()
                                {
                                    bonk(cImages[i], cWeights[i], cScales[i], cSounds[i], cVolumes[i], data.data, faceWidthMin, faceWidthMax, faceHeightMin, faceHeightMax, cImpactDecals[i]);
                                    if (++i >= cMax)
                                        clearInterval(bonker);
                                }, data.data.barrageFrequency * 1000);
                            }
                        }, data.data.customBonks[data.type].windupDelay * 1000);
                        break;
                }
            }
            socketVTube.send(JSON.stringify(request));
        }
    }
}

connectKarasu();
// Retry connection to Karasubot every 5 seconds
var tryConnectKarasu = setInterval(retryConnectKarasu, 1000 * 3);

function retryConnectKarasu()
{
    console.log("Retrying connection to Karasubot...");
    connectKarasu();
}

// VTube Studio API Scripts

var socketVTube;
var vTubeIsOpen = false;

function connectVTube()
{
    socketVTube = new WebSocket("ws://localhost:" + ports[1]);
    socketVTube.onopen = function()
    {
        console.log("Connected to VTube Studio!");

        clearInterval(tryConnectVTube);
        tryConnectVTube = setInterval(function()
        {
            if (socketVTube.readyState != 1)
            {
                vTubeIsOpen = false;
                console.log("Lost connection to VTube Studio!");
                endCalibration();
                clearInterval(tryConnectVTube);
                tryConnectVTube = setInterval(retryConnectVTube, 1000 * 3);
            }
        }, 1000 * 3);

        setTimeout(tryAuthorization, 1 + Math.random() * 2);
    };
}

connectVTube();
// Retry connection to VTube Studio every 3 seconds
var tryConnectVTube = setInterval(retryConnectVTube, 1000 * 3);

function retryConnectVTube()
{
    console.log("Retrying connection to VTube Studio...");
    connectVTube();
}

var failedAuth = false;
function tryAuthorization()
{
    if (!vTubeIsOpen && tryConnectVTube == null)
        tryConnectVTube = setInterval(retryConnectVTube, 1000 * 3);
    else if (karasuIsOpen)
    {
        if (failedAuth)
        {
            var request = {
                "apiName": "VTubeStudioPublicAPI",
                "apiVersion": "1.0",
                "requestID": "0",
                "messageType": "AuthenticationTokenRequest",
                "data": {
                    "pluginName": "KBonk",
                    "pluginDeveloper": "typeou.dev",
                    "pluginIcon": "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"
                }
            }
            socketVTube.onmessage = function(event)
            {
                socketVTube.onmessage = null;
                var response = JSON.parse(event.data);
                if (response.messageType == "AuthenticationTokenResponse")
                {
                    console.log("Received Authentication Token");
                    failedAuth = false;
        
                    request = {
                        "type": "setAuthVTS",
                        "token": response.data.authenticationToken
                    }
                    socketKarasu.send(JSON.stringify(request));
                }
                else if (response.messageType == "APIError" && response.data.errorID == 50)
                    console.log("Authentication Declined");
            }
            socketVTube.send(JSON.stringify(request));
        }
        else
        {
            var request = {
                "type": "getAuthVTS"
            }
            socketKarasu.send(JSON.stringify(request));
        }
    }
    else
    {
        setTimeout(tryAuthorization, 1000);
    }
}

// Report status of VTube studio connection once a second
setInterval(() => {
    if (karasuIsOpen)
    {
        var request = {
            "type": "status",
            "connectedVTube": vTubeIsOpen
        }
        socketKarasu.send(JSON.stringify(request));
    }
}, 1000);

function bonk(image, weight, scale, sound, volume, data, faceWidthMin, faceWidthMax, faceHeightMin, faceHeightMax, impactDecal)
{
    if (vTubeIsOpen)
    {
        var request = {
            "apiName": "VTubeStudioPublicAPI",
            "apiVersion": "1.0",
            "requestID": "4",
            "messageType": "CurrentModelRequest"
        }
        socketVTube.onmessage = function(event)
        {
            const pos = JSON.parse(event.data).data.modelPosition;
            if (pos != null)
            {
                const offsetX = faceWidthMin + (((pos.size + 100) / 200) * (faceWidthMax - faceWidthMin));
                const offsetY = faceHeightMin + (((pos.size + 100) / 200) * (faceHeightMax - faceHeightMin));
                const xPos = (parseFloat(pos.positionX - offsetX) + 1) / 2;
                const yPos = 1 - ((parseFloat(pos.positionY - offsetY) + 1) / 2);
                const fromLeft = Math.random() * 1.5 - 0.25 < xPos;
                const multH = fromLeft ? 1 : -1;
                const angle = ((Math.random() * (data.throwAngleMax - data.throwAngleMin)) + data.throwAngleMin) * multH;
                const sizeScale = data.itemScaleMin + (((pos.size + 100) / 200) * (data.itemScaleMax - data.itemScaleMin));
                const eyeState = data.closeEyes ? 1 : (data.openEyes ? 2 : 0);

                var audio, canPlayAudio;
                if (sound != null)
                {
                    audio = new Audio();
                    audio.src = sound.substr(0, sound.indexOf("/") + 1) + encodeURIComponent(sound.substr(sound.indexOf("/") + 1));
                    audio.volume = volume * data.volume;
                    canPlayAudio = false;
                    audio.oncanplaythrough = function() { canPlayAudio = true; }
                }
                else
                    canPlayAudio = true;

                var impact, canShowImpact;
                if (impactDecal != null)
                {
                    impact = new Image();
                    impact.src = "decals/" + encodeURIComponent(impactDecal.location.substr(7));
                    canShowImpact = false;
                    impact.onload = function() { canShowImpact = true; }
                }
                else
                    canShowImpact = true;

                var img = new Image();
                if (image.startsWith("https://static-cdn.jtvnw.net/emoticons/v1/"))
                    img.src = image;
                else
                    img.src = "throws/" + encodeURIComponent(image.substr(7));

                img.onload = async function()
                {
                    // Don't do anything until both image and audio are ready
                    while (!canPlayAudio || !canShowImpact)
                        await new Promise(resolve => setTimeout(resolve, 10));

                    var randScale = ((pos.size + 100) / 200);
                    var randH = (((Math.random() * 100) - 50) * randScale);
                    var randV = (((Math.random() * 100) - 50) * randScale);

                    var root = document.createElement("div");
                    root.classList.add("thrown");
                    root.style.width = "100%";
                    root.style.height = "100%";
                    root.style.transformOrigin = (((pos.positionX + 1) / 2) * 100) + "% " + ((1 - ((pos.positionY + 1) / 2)) * 100) + "%";
                    if (!data.physicsSim || data.physicsSim && data.physicsRotate)
                        root.style.transform = "rotate(" + pos.rotation + "deg)";
                    var pivot = document.createElement("div");
                    pivot.classList.add("thrown");
                    pivot.style.left = (window.innerWidth * xPos) - (img.width * scale * sizeScale / 2) + randH + "px";
                    pivot.style.top = (window.innerHeight * yPos) - (img.height * scale * sizeScale / 2) + randV + "px";
                    pivot.style.transform = "rotate(" + angle + "deg)";
                    var movement = document.createElement("div");
                    movement.classList.add("animated");
                    var animName = "throw" + (fromLeft ? "Left" : "Right");
                    movement.style.animationName = animName;
                    movement.style.animationDuration = data.throwDuration + "s";
                    movement.style.animationDelay = (data.delay / 1000) + "s";
                    var thrown = document.createElement("img");
                    thrown.classList.add("animated");
                    thrown.src = image;
                    thrown.style.width = img.width * scale * sizeScale + "px";
                    thrown.style.height = img.height * scale * sizeScale + "px";
                    if (data.spinSpeedMax - data.spinSpeedMin == 0)
                        thrown.style.transform = "rotate(" + -angle + "deg)";
                    else
                    {
                        thrown.style.animationName = "spin" + (Math.random() < 0.5 ? "Clockwise " : "CounterClockwise ");
                        thrown.style.animationDuration = (3 / (data.spinSpeedMin + (Math.random() * (data.spinSpeedMax - data.spinSpeedMin)))) + "s";
                        setTimeout(function() {
                            thrown.style.animationDuration = (1 / (data.spinSpeedMin + (Math.random() * (data.spinSpeedMax - data.spinSpeedMin)))) + "s";
                        }, (data.throwDuration * 500) + data.delay);
                        thrown.style.animationIterationCount = "infinite";
                    }
                    
                    movement.appendChild(thrown);
                    pivot.appendChild(movement);
                    root.appendChild(pivot);
                    document.querySelector("body").appendChild(root);
                    
                    setTimeout(function() { flinch(multH, angle, weight, data.parametersHorizontal, data.parametersVertical, data.parametersEyes, data.returnSpeed, eyeState); }, data.throwDuration * 500, data.throwAngleMin, data.throwAngleMax);
                
                    if (sound != null)
                        setTimeout(function() { audio.play(); }, (data.throwDuration * 500) + data.delay);
                
                    if (impactDecal != null)
                        setTimeout(function() {
                            const hit = document.createElement("img");
                            hit.classList.add("thrown");
                            hit.style.left = (window.innerWidth * xPos) - (impact.width * impactDecal.scale * sizeScale / 2) + randH + "px";
                            hit.style.top = (window.innerHeight * yPos) - (impact.height * impactDecal.scale * sizeScale / 2) + randV + "px";
                            hit.src = "decals/" + encodeURIComponent(impactDecal.location.substr(7));
                            hit.style.width = impact.width * impactDecal.scale * sizeScale + "px";
                            hit.style.height = impact.height * impactDecal.scale * sizeScale + "px";
                            document.querySelector("body").appendChild(hit);

                            setTimeout(function() { hit.remove(); }, impactDecal.duration * 1000);
                        }, (data.throwDuration * 500) + data.delay);
                    
                    if (!data.physicsSim)
                        setTimeout(function() { document.querySelector("body").removeChild(root); }, (data.throwDuration * 1000) + data.delay);
                    else
                    {
                        setTimeout(function() {
                            movement.style.animationName = "";
                            pivot.style.transform = "";
                            if (data.spinSpeedMax - data.spinSpeedMin == 0)
                                thrown.style.transform = "";
                            
                            var x = 0, y = 0;
                            var randV = Math.random();
                            var vX = randV * 3 * (fromLeft ? -1 : 1) * data.physicsHorizontal;
                            var vY = (1 - randV) * 10 * (angle < 0 ? -1 : 0.5) * data.physicsVertical;
    
                            objects.push({
                                "x": x,
                                "y": y,
                                "vX": vX,
                                "vY": vY,
                                "element": movement,
                                "root": root
                            });
    
                            if (data.physicsFPS != physicsFPS)
                            {
                                physicsFPS = data.physicsFPS;
                                if (physicsSimulator)
                                    clearInterval(physicsSimulator);
                                physicsSimulator = setInterval(simulatePhysics, 1000 / physicsFPS);
                            }
                            physicsGravityMult = data.physicsGravity;
                            physicsGravityReverse = data.physicsReverse;

                            if (!physicsSimulator)
                                physicsSimulator = setInterval(simulatePhysics, 1000 / physicsFPS);
                        }, (data.throwDuration * 500) + data.delay);
                    }
                }
            }
        }
        socketVTube.send(JSON.stringify(request));
    }
}

var physicsSimulator = null;
var physicsFPS = 60, physicsGravityMult = 1, physicsGravityReverse = false;
var objects = [];

function simulatePhysics()
{
    for (var i = 0; i < objects.length; i++)
    {
        objects[i].x += objects[i].vX;
        objects[i].vY += 30 * physicsGravityMult * (physicsGravityReverse ? -1 : 1) * (1 / physicsFPS);
        objects[i].y += objects[i].vY;
        objects[i].element.style.transform = "translate(" + objects[i].x + "vw," + objects[i].y + "vh)";
        if (objects[i].y > 100 || physicsGravityReverse && objects[i].y < -100)
        {
            document.querySelector("body").removeChild(objects[i].root);
            objects.splice(i--, 1);
        }
    }
}

var parametersH = [ "FaceAngleX", "FaceAngleZ", "FacePositionX"], parametersV = [ "FaceAngleY" ], parametersE = [ "EyeOpenLeft", "EyeOpenRight"];
function flinch(multH, angle, mag, paramH, paramV, paramE, returnSpeed, eyeState)
{
    var parameterValues = [];
    for (var i = 0; i < paramH.length; i++)
        parameterValues.push({ "id": paramH[i][0], "value": /* paramH[i][1] + */ (multH < 0 ? paramH[i][2] : paramH[i][3]) * mag });
    for (var i = 0; i < paramV.length; i++)
        parameterValues.push({ "id": paramV[i][0], "value": /* paramV[i][1] + */ (angle > 0 ? paramV[i][2] : paramV[i][3]) * Math.abs(angle) / 45 * mag });

    var request = {
        "apiName": "VTubeStudioPublicAPI",
        "apiVersion": "1.0",
        "requestID": "5",
        "messageType": "InjectParameterDataRequest",
        "data": {
            "faceFound": false,
            "mode": "add",
            "parameterValues": parameterValues
        }
    }

    var weight = 1, done;
    socketVTube.onmessage = function()
    {
        weight -= returnSpeed;
        done = weight <= 0;
        if (done)
            weight = 0;

        parameterValues = [];
        for (var i = 0; i < paramH.length; i++)
            parameterValues.push({ "id": paramH[i][0], "value": /* paramH[i][1] + */ (multH < 0 ? paramH[i][2] : paramH[i][3]) * mag * weight });
        for (var i = 0; i < paramV.length; i++)
            parameterValues.push({ "id": paramV[i][0], "value": /* paramV[i][1] + */ (multH * angle > 0 ? paramV[i][2] : paramV[i][3]) * Math.abs(angle) / 45 * mag * weight });

        if (eyeState == 1)
        {
            for (var i = 0; i < paramE.length; i++)
                parameterValues.push({ "id": paramE[i][0], "value": -paramE[i][1] * weight });
        }
        else if (eyeState == 2)
        {
            for (var i = 0; i < paramE.length; i++)
                parameterValues.push({ "id": paramE[i][0], "value": paramE[i][1] * weight });
        }

        request = {
            "apiName": "VTubeStudioPublicAPI",
            "apiVersion": "1.0",
            "requestID": "6",
            "messageType": "InjectParameterDataRequest",
            "data": {
                "faceFound": false,
                "mode": "add",
                "parameterValues": parameterValues
            }
        }

        socketVTube.send(JSON.stringify(request));
        if (done)
            socketVTube.onmessage = null;
    };
    socketVTube.send(JSON.stringify(request));
}