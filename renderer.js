const { throws } = require('assert');
const { ipcRenderer } = require('electron');
const fs = require("fs");

var status = 0;

const statusTitle = [
    "Ready!",
    "Not Authenticated",
    "Browser Source Disconnected",
    "Calibrating (1/2)",
    "Calibrating (2/2)",
    "VTube Studio Disconnected",
    "Listening for Redeem<br/>(Single)",
    "Listening for Redeem<br/>(Barrage)"
];

const statusDesc = [
    "",
    "<p>Please provide a valid OAuth token. You may click the button below to generate one with the required scopes.</p><p>Once acquired, please paste it into the \"OAuth Token\" section of the Settings window.",
    "<p>Please ensure OBS is open with <mark>bonker.html</mark> as the source file of an active and enabled Browser Source.</p><p>If you changed the port(s), please refresh the Browser Source.</p>",
    "<p>Please use VTube Studio to position your model's desired impact location in the center of the window and click the <mark>Confirm Calibration</mark> button below to continue.</p><p>The browser source in OBS is displaying a guide. Please do not resize the model during this process.</p>",
    "<p>Please use VTube Studio to position your model's desired impact location in the center of the window and click the <mark>Confirm Calibration</mark> button below to continue.</p><p>The browser source in OBS is displaying a guide. Please do not resize the model during this process.</p>",
    [ "<p>Please ensure VTube Studio is open with the API enabled on port <mark>", "</mark> and click Allow when Karasubonk requests access.</p><p>If you clicked Deny on the popup or changed the port(s), please refresh the Browser Source.</p>" ],
    "<p>Please use the Channel Point Reward you'd like to use for single bonks.</p>",
    "<p>Please use the Channel Point Reward you'd like to use for barrage bonks.</p>"
];

document.querySelector("#loadImage").addEventListener("change", () => {
    const imageFile = document.querySelector("#loadImage").files[0];
    fs.copyFileSync(imageFile.path, __dirname + "/throws/" + imageFile.name);
    var throws = getData("throws");
    var contains = false;
    for (var i = 0; i < throws.length; i++)
    {
        if (throws[i][0] == "throws/" + imageFile.name)
        {
            contains = true;
            break;
        }
    }
    
    if (!contains)
    {
        console.log("a");
        throws.push([ "throws/" + imageFile.name, 1.0, 1.0 ]);
        console.log(throws);
        setData("throws", throws);
        openImages();
    }
});

function openImages()
{
    document.querySelectorAll(".imageRow").forEach((element) => { element.remove(); });
    
    var throws = getData("throws");
    for (var i = throws.length - 1; i >= 0; i--)
    {
        if (fs.existsSync(__dirname + "/" + throws[i][0]))
        {
            var row = document.querySelector("#imageRow").cloneNode(true);
            row.id = "";
            row.classList.add("imageRow");
            row.removeAttribute("hidden");
            row.querySelector(".imageName").value = throws[i][0].substr(8);
            document.querySelector("#imageTable").appendChild(row);

            row.querySelector(".removeImage").addEventListener("click", () => {
                throws.splice(i, 1);
                setData("throws", throws);
                row.remove();
            });

            row.querySelector(".imageHover").addEventListener("mouseover", () => {
                document.querySelector("#imagePreview").src = "throws/" + row.querySelector(".imageName").value;
                document.querySelector("#imagePreviewParent").removeAttribute("hidden");
            });

            row.querySelector(".imageHover").addEventListener("mouseout", () => {
                document.querySelector("#imagePreviewParent").hidden = "hidden";
            });

            row.querySelector(".imageWeight").value = throws[i][1];
            row.querySelector(".imageScale").value = throws[i][2];
            if (throws[i][3] != null)
            {
                if (fs.existsSync(__dirname + "/" + throws[i][3]))
                {
                    row.querySelector(".imageSound").value = throws[i][3].substr(8);
                    row.querySelector(".imageSoundVolume").value = throws[i][4];
                    row.querySelector(".imageSoundVolume").addEventListener("change", () => {
                        clampValue(row.querySelector(".imageSoundVolume"), 0, 1);
                        throws[i][1] = parseFloat(row.querySelector(".imageSoundVolume").value);
                        setData("throws", throws);
                    });
                }
                else
                {
                    row.querySelector(".imageSoundVolume").disabled = "disabled";
                    throws[i].splice(3, 1);
                    setData("throws", throws);
                }
            }
            else
                row.querySelector(".imageSoundVolume").disabled = "disable";

            row.querySelector(".imageWeight").addEventListener("change", () => {
                throws[i][1] = parseFloat(row.querySelector(".imageWeight").value);
                setData("throws", throws);
            });

            row.querySelector(".imageScale").addEventListener("change", () => {
                throws[i][2] = parseFloat(parseFloat(row.querySelector(".imageScale").value));
                setData("throws", throws);
            });

            row.querySelector(".removeSound").addEventListener("click", () => {
                row.querySelector(".imageSound").value = "";
                throws[i].splice(3, 2);
                row.querySelector(".imageSoundVolume").value = "";
                row.querySelector(".imageSoundVolume").disabled = "disabled";
                setData("throws", throws);
            });

            row.querySelector(".imageSoundLoad").addEventListener("change", () => {
                const soundFile = row.querySelector(".imageSoundLoad").files[0];
                fs.copyFileSync(soundFile.path, __dirname + "/impacts/" + soundFile.name);
                row.querySelector(".imageSound").value = soundFile.name;
                row.querySelector(".imageScale").value = 1;
                throws[i][2] = 1;
                throws[i][3] = "impacts/" + soundFile.name;
                throws[i][4] = 1;
                setData("throws", throws);
                row.querySelector(".imageSoundVolume").value = 1;
                row.querySelector(".imageSoundVolume").removeAttribute("disabled");
            });
        }
        else
        {
            throws.splice(i, 1);
            setData("throws", throws);
        }
    }
}

document.querySelector("#loadSound").addEventListener("change", () => {
    const soundFile = document.querySelector("#loadSound").files[0];
    fs.copyFileSync(soundFile.path, __dirname + "/impacts/" + soundFile.name);
    var impacts = getData("impacts");
    var contains = false;
    for (var i = 0; i < impacts.length; i++)
    {
        if (impacts[i][0] == "impacts/" + soundFile.name)
        {
            contains = true;
            break;
        }
    }

    if (!contains)
    {
        impacts.push([ "impacts/" + soundFile.name, 1.0 ]);
        setData("impacts", impacts);
        openSounds();
    }
});

function openSounds()
{
    document.querySelectorAll(".soundRow").forEach((element) => { element.remove(); });
    
    var impacts = getData("impacts");
    for (var i = impacts.length - 1; i >= 0; i--)
    {
        if (fs.existsSync(__dirname + "/" + impacts[i][0]))
        {
                var row = document.querySelector("#soundRow").cloneNode(true);
                row.id = "";
                row.classList.add("soundRow");
                row.removeAttribute("hidden");
                row.querySelector(".soundName").value = impacts[i][0].substr(7);
                document.querySelector("#soundTable").appendChild(row);

                row.querySelector(".removeSound").addEventListener("click", () => {
                    impacts.splice(i, 1);
                    setData("impacts", impacts);
                    row.remove();
                });

                row.querySelector(".soundVolume").value = impacts[i][1];
                row.querySelector(".soundVolume").addEventListener("change", () => {
                    clampValue(row.querySelector(".soundVolume"), 0, 1);
                    impacts[i][1] = parseFloat(row.querySelector(".soundVolume").value);
                    setData("impacts", impacts);
                });
        }
        else
        {
            impacts.splice(i, 1);
            setData("impacts", impacts);
        }
    }
}

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
document.querySelector("#bitsMaxBarrageCount").addEventListener("change", () => { clampValue(document.querySelector("#bitsMaxBarrageCount"), 0, null); setData("bitsMaxBarrageCount", parseInt(document.querySelector("#bitsMaxBarrageCount").value)) });

document.querySelector("#singleRedeemCooldown").addEventListener("change", () => { clampValue(document.querySelector("#singleRedeemCooldown"), 0, null); setData("singleRedeemCooldown", parseFloat(document.querySelector("#singleRedeemCooldown").value)) });
document.querySelector("#barrageRedeemCooldown").addEventListener("change", () => { clampValue(document.querySelector("#barrageRedeemCooldown"), 0, null); setData("barrageRedeemCooldown", parseFloat(document.querySelector("#barrageRedeemCooldown").value)) });
document.querySelector("#singleCommandCooldown").addEventListener("change", () => { clampValue(document.querySelector("#singleCommandCooldown"), 0, null); setData("singleCommandCooldown", parseFloat(document.querySelector("#singleCommandCooldown").value)) });
document.querySelector("#barrageCommandCooldown").addEventListener("change", () => { clampValue(document.querySelector("#barrageCommandCooldown"), 0, null); setData("barrageCommandCooldown", parseFloat(document.querySelector("#barrageCommandCooldown").value)) });
document.querySelector("#subCooldown").addEventListener("change", () => { clampValue(document.querySelector("#subCooldown"), 0, null); setData("subCooldown", parseFloat(document.querySelector("#subCooldown").value)) });
document.querySelector("#subGiftCooldown").addEventListener("change", () => { clampValue(document.querySelector("#subGiftCooldown"), 0, null); setData("subGiftCooldown", parseFloat(document.querySelector("#subGiftCooldown").value)) });
document.querySelector("#bitsCooldown").addEventListener("change", () => { clampValue(document.querySelector("#bitsCooldown"), 0, null); setData("bitsEnabled", parseFloat(document.querySelector("#bitsCooldown").value)) });

document.querySelector("#barrageCount").addEventListener("change", () => { clampValue(document.querySelector("#barrageCount"), 0, null); setData("barrageCount", parseInt(document.querySelector("#barrageCount").value)) });
document.querySelector("#barrageFrequency").addEventListener("change", () => { clampValue(document.querySelector("#barrageFrequency"), 0, null); setData("barrageFrequency", parseFloat(document.querySelector("#barrageFrequency").value)) });
document.querySelector("#returnSpeed").addEventListener("change", () => { clampValue(document.querySelector("#returnSpeed"), 0, null); setData("returnSpeed", parseFloat(document.querySelector("#returnSpeed").value)) });
document.querySelector("#delay").addEventListener("change", () => { clampValue(document.querySelector("#delay"), 0, null); setData("delay", parseInt(document.querySelector("#delay").value)) } );
document.querySelector("#volume").addEventListener("change", () => { clampValue(document.querySelector("#volume"), 0, 1); setData("volume", parseFloat(document.querySelector("#volume").value)) });
document.querySelector("#portThrower").addEventListener("change", () => setData("portThrower", parseInt(document.querySelector("#portThrower").value)));
document.querySelector("#portVTubeStudio").addEventListener("change", () => setData("portVTubeStudio", parseInt(document.querySelector("#portVTubeStudio").value)));
document.querySelector("#accessToken").addEventListener("change", () => setData("accessToken", document.querySelector("#accessToken").value));

function clampValue(node, min, max)
{
    var val = node.value;
    if (min != null && val < min)
        val = min;
    if (max != null && val > max)
        val = max;
    node.value = val;
}

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

document.querySelector('#HelpButton').addEventListener('click', () => { showPanel("help"); });
document.querySelector('#ImagesButton').addEventListener('click', () => { showPanel("images"); });
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
                    currentPanel.hidden = "hidden";
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
    if (panel == "images")
        openImages();
    else if (panel == "sounds")
        openSounds();

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