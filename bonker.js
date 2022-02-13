// Karasubot Websocket Scripts

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

        if (data.type == "calibrating")
        {
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
                            "positionX": 0.0,
                            "positionY": 0.0,
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
                            "positionX": tempData.modelPosition.positionX,
                            "positionY": tempData.modelPosition.positionY,
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
                            "positionX": 0.0,
                            "positionY": 0.0,
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
                            "positionX": tempData.modelPosition.positionX,
                            "positionY": tempData.modelPosition.positionY,
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
        else if (!isCalibrating && vTubeIsOpen)
        {
            var request = {
                "apiName": "VTubeStudioPublicAPI",
                "apiVersion": "1.0",
                "requestID": "3",
                "messageType": "InputParameterListRequest"
            }
            socketVTube.onmessage = function(event)
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

                console.log("Received " + data.type);

                switch(data.type)
                {
                    case "single":
                        bonk(data.image, data.weight, data.scale, data.sound, data.volume, data.data, faceWidthMin, faceWidthMax, faceHeightMin, faceHeightMax);
                        break;
                    case "barrage":
                        var i = 0;
                        const images = data.image;
                        const weights = data.weight;
                        const scales = data.scale;
                        const sounds = data.sound;
                        const volumes = data.volume;
                        const max = Math.min(images.length, sounds.length, weights.length);

                        var bonker = setInterval(function()
                        {
                            bonk(images[i], weights[i], scales[i], sounds[i], volumes[i], data.data, faceWidthMin, faceWidthMax, faceHeightMin, faceHeightMax);
                            if (++i >= max)
                                clearInterval(bonker);
                        }, data.data.barrageFrequency * 1000);
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
        clearInterval(tryConnectVTube);
        console.log("Connected to VTube Studio!");

        var request = {
            "apiName": "VTubeStudioPublicAPI",
            "apiVersion": "1.0",
            "requestID": "0",
            "messageType": "AuthenticationTokenRequest",
            "data": {
                "pluginName": "Karasubonk",
                "pluginDeveloper": "typeou.dev",
                "pluginIcon": "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"
            }
        }
        socketVTube.onmessage = function(event)
        {
            socketVTube.onmessage = null;
            var response = JSON.parse(event.data);
            if (response.data.authenticationToken != null)
            {
                request = {
                    "apiName": "VTubeStudioPublicAPI",
                    "apiVersion": "1.0",
                    "requestID": "1",
                    "messageType": "AuthenticationRequest",
                    "data": {
                        "pluginName": "Karasubonk", 
                        "pluginDeveloper": "typeou.dev",
                        "authenticationToken": response.data.authenticationToken
                    }
                }
                socketVTube.onmessage = function(event)
                {
                    socketVTube.onmessage = null;
                    response = JSON.parse(event.data);
                    if (response.data.authenticated)
                        vTubeIsOpen = true;
                }
                socketVTube.send(JSON.stringify(request));
            }
        }
        socketVTube.send(JSON.stringify(request));
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

function bonk(image, weight, scale, sound, volume, data, faceWidthMin, faceWidthMax, faceHeightMin, faceHeightMax)
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

                if (sound != null)
                {
                    var audio = new Audio();
                    audio.src = sound.substr(0, sound.indexOf("/") + 1) + encodeURIComponent(sound.substr(sound.indexOf("/") + 1));
                    audio.volume = ((weight / 2) + 0.5) * volume * data.volume;
                    var canPlayAudio = false;
                    audio.oncanplaythrough = function() { canPlayAudio = true; }
                }
                else
                    canPlayAudio = true;

                var img = new Image();
                if (image.startsWith("https://static-cdn.jtvnw.net/emoticons/v1/"))
                    img.src = image;
                else
                    img.src = "throws/" + encodeURIComponent(image.substr(7));

                img.onload = function()
                {
                    var pivot = document.createElement("div");
                    pivot.classList.add("thrown");
                    pivot.style.left = (window.innerWidth * xPos) - (img.width * scale * sizeScale / 2) + ((Math.random() * 100) - 50) + "px";
                    pivot.style.top = (window.innerHeight * yPos) - (img.height * scale * sizeScale / 2) + ((Math.random() * 100) - 50) + "px";
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
                    var animName = "spin" + (Math.random() < 0.5 ? "Clockwise " : "CounterClockwise ");
                    thrown.style.animation = animName + ((Math.random() * 0.4) + 0.1) + "s";
                    thrown.style.animationIterationCount = "infinite";
                    
                    movement.appendChild(thrown);
                    pivot.appendChild(movement);
                    document.querySelector("body").appendChild(pivot);


                    // Don't do anything until both image and audio are ready
                    if (canPlayAudio)
                    {
                        setTimeout(function() { flinch(multH, angle, weight, data.parametersHorizontal, data.parametersVertical, data.returnSpeed, eyeState); }, data.throwDuration * 500, data.throwAngleMin, data.throwAngleMax);

                        if (sound != null)
                            setTimeout(function() { audio.play(); }, (data.throwDuration * 500) + data.delay);
                        
                        setTimeout(function() { document.querySelector("body").removeChild(pivot); }, (data.throwDuration * 1000) + data.delay);
                    }
                    else
                    {
                        audio.oncanplaythrough = function()
                        {
                            setTimeout(function() { flinch(multH, angle, weight, data.parametersHorizontal, data.parametersVertical, data.returnSpeed, eyeState); }, data.throwDuration * 500, data.throwAngleMin, data.throwAngleMax);

                            setTimeout(function() { audio.play(); }, (data.throwDuration * 500) + data.delay);
                            
                            setTimeout(function() { document.querySelector("body").removeChild(pivot); }, (data.throwDuration * 1000) + data.delay);
                        }
                    }
                }
            }
        }
        socketVTube.send(JSON.stringify(request));
    }
}

var parametersH = [ "FaceAngleX", "FaceAngleZ", "FacePositionX"], parametersV = [ "FaceAngleY" ];
function flinch(multH, angle, mag, paramH, paramV, returnSpeed, eyeState, throwAngleMin, throwAngleMax)
{
    var parameterValues = [];
    for (var i = 0; i < paramH.length; i++)
        parameterValues.push({ "id": paramH[i][0], "value": paramH[i][1] + (multH < 0 ? paramH[i][2] : paramH[i][3]) * mag });
    for (var i = 0; i < paramV.length; i++)
        parameterValues.push({ "id": paramV[i][0], "value": paramV[i][1] + (angle > 0 ? paramV[i][2] : paramV[i][3]) * Math.abs(angle) / 45 * mag });

    var request = {
        "apiName": "VTubeStudioPublicAPI",
        "apiVersion": "1.0",
        "requestID": "5",
        "messageType": "InjectParameterDataRequest",
        "data": {
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
            parameterValues.push({ "id": paramH[i][0], "weight": weight, "value": paramH[i][1] + (multH < 0 ? paramH[i][2] : paramH[i][3]) * mag });
        for (var i = 0; i < paramV.length; i++)
            parameterValues.push({ "id": paramV[i][0], "weight": weight, "value": paramV[i][1] + (multH * angle > 0 ? paramV[i][2] : paramV[i][3]) * Math.abs(angle) / 45 * mag });

        if (eyeState == 1)
        {
            parameterValues.push({ "id": "EyeOpenLeft", "weight": weight, "value": 0 });
            parameterValues.push({ "id": "EyeOpenRight", "weight": weight, "value": 0 });
        }
        else if (eyeState == 2)
        {
            parameterValues.push({ "id": "EyeOpenLeft", "weight": weight, "value": 1 });
            parameterValues.push({ "id": "EyeOpenRight", "weight": weight, "value": 1 });
        }

        request = {
            "apiName": "VTubeStudioPublicAPI",
            "apiVersion": "1.0",
            "requestID": "6",
            "messageType": "InjectParameterDataRequest",
            "data": {
                "parameterValues": parameterValues
            }
        }

        socketVTube.send(JSON.stringify(request));
        if (done)
            socketVTube.onmessage = null;
    };
    socketVTube.send(JSON.stringify(request));
}