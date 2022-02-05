const { ipcRenderer, webContents } = require('electron');
const fs = require("fs");

var status = 2;

const statusTitle = [
    "Ready!",
    "Not connected to Browser Source",
    "Browser Source not connected to VTube Studio",
    "Calibrating (Step 1)",
    "Calibrating (Step 2)"
];

const statusDesc = [
    "",
    "Please have OBS open with bonker.html added as a Browser Source",
    [ "Please have VTube Studio open with the API enabled on port ", " and click Allow when Karasubonk requests access.\nYou may need to refresh the Browser Source if you clicked Deny." ],
    "Please position your model's face in the center of the screen.\nThe browser source is displaying a guide.\nDo not resize the model.",
    "Please position your model's face in the center of the screen.\nThe browser source is displaying a guide.\nDo not resize the model."
];

document.querySelector('#single').addEventListener('click', () => { ipcRenderer.send('single'); });
document.querySelector('#startCalibrate').addEventListener('click', () => { ipcRenderer.send('startCalibrate'); });
document.querySelector('#nextCalibrate').addEventListener('click', () => { ipcRenderer.send('nextCalibrate'); });
document.querySelector('#barrage').addEventListener('click', () => { ipcRenderer.send('barrage'); });
document.querySelector('#bits').addEventListener('click', () => { ipcRenderer.send('bits'); });

ipcRenderer.on("status", (event, message) => {
    status = message;
    document.querySelector("#status").innerText = statusTitle[status];
    if (status != 2)
        document.querySelector("#statusDesc").innerText = statusDesc[status];
    else
        document.querySelector("#statusDesc").innerText = statusDesc[status][0] + getData("portVTubeStudio") + statusDesc[status][1];
});

function getData(field)
{
    var data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));
    return data[field];
}

function setData(field, value)
{
    ipcRenderer.send("setData", [ field, value ]);
}