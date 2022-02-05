const { ipcRenderer } = require('electron');
const fs = require("fs");

var status = 0;

const statusTitle = [
    "Ready!",
    "Not Authenticated",
    "Browser Source Disconnected",
    "Calibrating Minimum<br/>(Step 1/2)",
    "Calibrating Maximum<br/>(Step 2/2)",
    "VTube Studio Disconnected",
    "Listening for Redeem<br/>(Single)",
    "Listening for Redeem<br/>(Barrage)"
];

const statusDesc = [
    "",
    "<p>Please provide a valid OAuth token. You may click the button below to generate one with the required scopes.</p><p>Once acquired, please paste it into the \"OAuth Token\" section of the Settings window.",
    "<p>Please ensure OBS is open with <mark>bonker.html</mark> as the source file of an active and enabled Browser Source.</p><p>If you changed the port(s), please refresh the Browser Source.</p>",
    "<p>Please position your model's desired impact location in the center of the window and click the <mark>Confirm Calibration</mark> button below to continue.</p><p>The browser source in OBS is displaying a guide.<p>Please do not manually resize the model during this process.</p>",
    "<p>Please position your model's desired impact location in the center of the window and click the <mark>Confirm Calibration</mark> button below to continue.</p><p>The browser source in OBS is displaying a guide.<p>Please do not manually resize the model during this process.</p>",
    [ "<p>Please ensure VTube Studio is open with the API enabled on port <mark>", "</mark> and click Allow when Karasubonk requests access.</p><p>If you clicked Deny on the popup or changed the port(s), please refresh the Browser Source.</p>" ],
    "<p>Please use the Channel Point Reward you'd like to use for single bonks.</p>",
    "<p>Please use the Channel Point Reward you'd like to use for barrage bonks.</p>"
];

document.querySelector('#single').addEventListener('click', () => { ipcRenderer.send('single'); });
document.querySelector('#startCalibrate').addEventListener('click', () => { ipcRenderer.send('startCalibrate'); });
document.querySelector('#nextCalibrate').addEventListener('click', () => { ipcRenderer.send('nextCalibrate'); });
document.querySelector('#cancelCalibrate').addEventListener('click', () => { ipcRenderer.send('cancelCalibrate'); });
document.querySelector('#barrage').addEventListener('click', () => { ipcRenderer.send('barrage'); });
document.querySelector('#bits').addEventListener('click', () => { ipcRenderer.send('bits'); });
document.querySelector("#oAuthLink").addEventListener('click', () => { ipcRenderer.send('oauth'); });

ipcRenderer.on("status", (event, message) => {
    status = message;
    document.querySelector("#status").innerHTML = statusTitle[status];

    if (status != 5)
        document.querySelector("#statusDesc").innerHTML = statusDesc[status];
    else
        document.querySelector("#statusDesc").innerHTML = statusDesc[status][0] + getData("portVTubeStudio") + statusDesc[status][1];

    if (status == 1)
        document.querySelector("#oAuthButton").classList.remove("hide");
    else
        document.querySelector("#oAuthButton").classList.add("hide");

    if (status == 3 || status == 4)
        document.querySelector("#calibrateButtons").classList.remove("hide");
    else
        document.querySelector("#calibrateButtons").classList.add("hide");
});

window.onload = function()
{
    document.querySelector("#singleRedeemEnabled").checked = getData("singleRedeemEnabled");
    document.querySelector("#barrageRedeemEnabled").checked = getData("barrageRedeemEnabled");
    document.querySelector("#singleCommandEnabled").checked = getData("singleCommandEnabled");
    document.querySelector("#barrageCommandEnabled").checked = getData("barrageCommandEnabled");
    document.querySelector("#subEnabled").checked = getData("subEnabled");
    document.querySelector("#subGiftEnabled").checked = getData("subGiftEnabled");
    document.querySelector("#bitsEnabled").checked = getData("bitsEnabled");

    document.querySelector("#singleCommandTitle").value = getData("singleCommandTitle");
    document.querySelector("#barrageCommandTitle").value = getData("barrageCommandTitle");
    document.querySelector("#subType").value = getData("subType");
    document.querySelector("#subGiftType").value = getData("subGiftType");
    document.querySelector("#bitsMaxBarrageCount").value = getData("bitsMaxBarrageCount");
    
    document.querySelector("#singleRedeemCooldown").value = getData("singleRedeemCooldown");
    document.querySelector("#barrageRedeemCooldown").value = getData("barrageRedeemCooldown");
    document.querySelector("#singleCommandCooldown").value = getData("singleCommandCooldown");
    document.querySelector("#barrageCommandCooldown").value = getData("barrageCommandCooldown");
    document.querySelector("#subCooldown").value = getData("subCooldown");
    document.querySelector("#subGiftCooldown").value = getData("subGiftCooldown");
    document.querySelector("#bitsCooldown").value = getData("bitsCooldown");
    
    document.querySelector("#barrageCount").value = getData("barrageCount");
    document.querySelector("#barrageFrequency").value = getData("barrageFrequency");
    document.querySelector("#returnSpeed").value = getData("returnSpeed");
    document.querySelector("#delay").value = getData("delay");
    document.querySelector("#volume").value = getData("volume");
    document.querySelector("#portThrower").value = getData("portThrower");
    document.querySelector("#portVTubeStudio").value = getData("portVTubeStudio");
    document.querySelector("#accessToken").value = getData("accessToken");
}

document.querySelector("#singleRedeemEnabled").addEventListener("change", () => setData("singleRedeemEnabled", document.querySelector("#singleRedeemEnabled").checked));
document.querySelector("#barrageRedeemEnabled").addEventListener("change", () => setData("barrageRedeemEnabled", document.querySelector("#barrageRedeemEnabled").checked));
document.querySelector("#singleCommandEnabled").addEventListener("change", () => setData("singleCommandEnabled", document.querySelector("#singleCommandEnabled").checked));
document.querySelector("#barrageCommandEnabled").addEventListener("change", () => setData("barrageCommandEnabled", document.querySelector("#barrageCommandEnabled").checked));
document.querySelector("#subEnabled").addEventListener("change", () => setData("subEnabled", document.querySelector("#subEnabled").checked));
document.querySelector("#subGiftEnabled").addEventListener("change", () => setData("subGiftEnabled", document.querySelector("#subGiftEnabled").checked));
document.querySelector("#bitsEnabled").addEventListener("change", () => setData("bitsEnabled", document.querySelector("#bitsEnabled").checked));

document.querySelector("#singleRedeemID").addEventListener("click", () => { ipcRenderer.send('listenSingle'); });
document.querySelector("#barrageRedeemID").addEventListener("click", () => { ipcRenderer.send('listenBarrage'); });

document.querySelector("#singleCommandTitle").addEventListener("change", () => setData("singleCommandTitle", document.querySelector("#singleCommandTitle").value));
document.querySelector("#barrageCommandTitle").addEventListener("change", () => setData("barrageCommandTitle", document.querySelector("#barrageCommandTitle").value));
document.querySelector("#subType").addEventListener("change", () => setData("subType", document.querySelector("#subType").value));
document.querySelector("#subGiftType").addEventListener("change", () => setData("subGiftType", document.querySelector("#subGiftType").value));
document.querySelector("#bitsMaxBarrageCount").addEventListener("change", () => setData("bitsMaxBarrageCount", document.querySelector("#bitsMaxBarrageCount").value));

document.querySelector("#singleRedeemCooldown").addEventListener("change", () => setData("singleRedeemCooldown", document.querySelector("#singleRedeemCooldown").value));
document.querySelector("#barrageRedeemCooldown").addEventListener("change", () => setData("barrageRedeemCooldown", document.querySelector("#barrageRedeemCooldown").value));
document.querySelector("#singleCommandCooldown").addEventListener("change", () => setData("singleCommandCooldown", document.querySelector("#singleCommandCooldown").value));
document.querySelector("#barrageCommandCooldown").addEventListener("change", () => setData("barrageCommandCooldown", document.querySelector("#barrageCommandCooldown").value));
document.querySelector("#subCooldown").addEventListener("change", () => setData("subCooldown", document.querySelector("#subCooldown").value));
document.querySelector("#subGiftCooldown").addEventListener("change", () => setData("subGiftCooldown", document.querySelector("#subGiftCooldown").value));
document.querySelector("#bitsCooldown").addEventListener("change", () => setData("bitsEnabled", document.querySelector("#bitsCooldown").value));

document.querySelector("#barrageCount").addEventListener("change", () => setData("barrageCount", document.querySelector("#barrageCount").value));
document.querySelector("#barrageFrequency").addEventListener("change", () => setData("barrageFrequency", document.querySelector("#barrageFrequency").value));
document.querySelector("#returnSpeed").addEventListener("change", () => setData("returnSpeed", document.querySelector("#returnSpeed").value));
document.querySelector("#delay").addEventListener("change", () => setData("delay", document.querySelector("#delay").value));
document.querySelector("#volume").addEventListener("change", () => setData("volume", document.querySelector("#volume").value));
document.querySelector("#portThrower").addEventListener("change", () => setData("portThrower", document.querySelector("#portThrower").value));
document.querySelector("#portVTubeStudio").addEventListener("change", () => setData("portVTubeStudio", document.querySelector("#portVTubeStudio").value));
document.querySelector("#accessToken").addEventListener("change", () => setData("accessToken", document.querySelector("#accessToken").value));

function getData(field)
{
    var data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));
    return data[field];
}

function setData(field, value)
{
    ipcRenderer.send("setData", [ field, value ]);
    if (field == "portThrower" || field == "portVTubeStudio")
        setPorts();
}

function setPorts()
{
    fs.writeFileSync(__dirname + "/ports.js", "var ports = [ " + getData("portThrower") + ", " + getData("portVTubeStudio") + " ];");
}

document.querySelector('#ItemsButton').addEventListener('click', () => { showPanel("items"); });
document.querySelector('#SoundsButton').addEventListener('click', () => { showPanel("sounds"); });
document.querySelector('#EventsButton').addEventListener('click', () => { showPanel("events"); });
document.querySelector('#SettingsButton').addEventListener('click', () => { showPanel("settings"); });

var currentPanel = null, playing = false;
function showPanel(panel)
{
    if (!playing)
    {
        if (currentPanel != null)
        {
            var currentAnim = 0;
            if (currentPanel.classList.contains("open1"))
            {
                currentAnim = 1;
                currentPanel.classList.remove("open1");
            }
            else if (currentPanel.classList.contains("open2"))
            {
                currentAnim = 2;
                currentPanel.classList.remove("open2");
            }
            else if (currentPanel.classList.contains("open3"))
            {
                currentAnim = 3;
                currentPanel.classList.remove("open3");
            }
            else if (currentPanel.classList.contains("open4"))
            {
                currentAnim = 4;
                currentPanel.classList.remove("open4");
            }
    
            var newAnim;
            do {
                newAnim = Math.floor(Math.random() * 4) + 1;
            } while (newAnim == currentAnim);
            currentPanel.classList.add("open" + newAnim);
            currentPanel.classList.add("reverse");
            
            playing = true;
            setTimeout(() => {
                playing = false;
                if (document.querySelector("#" + panel) != currentPanel)
                    openPanel(panel);
                else
                {
                    currentPanel.hidden = "";
                    currentPanel = null;
                }
            }, 500);
        }
        else
            openPanel(panel)
    }
}

function openPanel(panel)
{
    currentPanel = document.querySelector("#" + panel);

    var currentAnim = 0;
    if (currentPanel.classList.contains("open1"))
    {
        currentAnim = 1;
        currentPanel.classList.remove("open1");
    }
    else if (currentPanel.classList.contains("open2"))
    {
        currentAnim = 2;
        currentPanel.classList.remove("open2");
    }
    else if (currentPanel.classList.contains("open3"))
    {
        currentAnim = 3;
        currentPanel.classList.remove("open3");
    }
    else if (currentPanel.classList.contains("open4"))
    {
        currentAnim = 4;
        currentPanel.classList.remove("open4");
    }

    var newAnim;
    do {
        newAnim = Math.floor(Math.random() * 4) + 1;
    } while (newAnim == currentAnim);

    currentPanel.classList.add("open" + newAnim);
    currentPanel.classList.remove("reverse");
    currentPanel.removeAttribute("hidden");

    playing = true;
    setTimeout(() => {
        playing = false;
    }, 500);
}