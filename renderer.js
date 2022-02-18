const { ipcRenderer, app } = require('electron');
const fs = require("fs");

var status = 0;

const statusTitle = [
    "Ready!",
    "Not Authenticated",
    "Connecting to KBonk Browser Source...",
    "Calibrating (1/2)",
    "Calibrating (2/2)",
    "Connecting to VTube Studio...",
    "Listening for Redeem<br/>(Single)",
    "Listening for Redeem<br/>(Barrage)",
    "Waiting for Listeners...",
    "Calibration",
    "Authenticating..."
];

const statusDesc = [
    "",
    "<p>Please provide a valid OAuth token. You may click the button below to generate one with the required scopes.</p><p>Once acquired, please paste it into the \"OAuth Token\" section of the Settings window.</p>",
    "<p>If this message doesn't disappear after a few seconds, please refresh the KBonk Browser Source in OBS.</p><p>The KBonk Browser Source should be active with <mark>karasubonk/resources/app/bonker.html</mark> as the source file.</p>",
    "<p>Please use VTube Studio to position your model's head under the guide being displayed in OBS.</p><p><small>Your VTube Studio Source and KBonk Browser Source should be overlapping.</small></p><p>Press the <mark>Continue Calibration</mark> button below to continue to the next step.</p>",
    "<p>Please use VTube Studio to position your model's head under the guide being displayed in OBS.</p><p><small>Your VTube Studio Source and KBonk Browser Source should be overlapping.</small></p><p>Press the <mark>Confirm Calibration</mark> button below to finish calibration.</p>",
    [ "<p>If this message doesn't disappear after a few seconds, please refresh the KBonk Browser Source.</p><p>If that doesn't work, please ensure the VTube Studio API is enabled on port <mark>", "</mark>.</p>" ],
    "<p>Please use the Channel Point Reward you'd like to use for single bonks.</p><p>Click the Listen button again to cancel.</p>",
    "<p>Please use the Channel Point Reward you'd like to use for barrage bonks.</p><p>Click the Listen button again to cancel.</p>",
    "",
    "<p>This short process will decide the impact location of thrown objects.</p><p>Please click \"Start Calibration\" to start the calibration process.</p>",
    ""
];

// Counter for number of writes that are being attempted
// Will only attempt to load data if not currently writing
// Inter-process communication means this is necessary
var isWriting = 0;
ipcRenderer.on("doneWriting", () => {
    if (--isWriting < 0)
        isWriting = 0;
});

// Adding a new image to the list
document.querySelector("#loadImage").addEventListener("change", loadImage);

async function loadImage()
{
    // Grab the image that was just loaded
    const imageFile = document.querySelector("#loadImage").files[0];
    // If the folder for objects doesn't exist for some reason, make it
    if (!fs.existsSync(__dirname + "/throws/"))
        fs.mkdirSync(__dirname + "/throws/");

    // Ensure that we're not overwriting any existing files with the same name
    // If a file already exists, add an interating number to the end until it's a unique filename
    var append = "";
    while (fs.existsSync(imageFile.path, __dirname + "/throws/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".") + 1)))
        append = append == "" ? 2 : (append + 1);
    imageFile.name = imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".") + 1);

    // Make a copy of the file into the local folder
    fs.copyFileSync(imageFile.path, __dirname + "/throws/" + imageFile.name);
    
    // Get the existing images, add the new image, update the data, and refresh the images page
    var throws = await getData("throws");
    throws.push({
        "location": "throws/" + imageFile.name,
        "weight": 1.0,
        "scale": 1.0,
        "sound": null,
        "volume": null,
        "enabled": true
    });
    setData("throws", throws);
    openImages();
    
    // Reset the image upload
    document.querySelector("#loadImage").value = null;
}

async function openImages()
{
    var throws = await getData("throws");

    document.querySelectorAll(".imageRow").forEach((element) => { element.remove(); });

    if (throws == null)
        setData("throws", []);
    else
    {
        throws.forEach((_, index) =>
        {
            // For those upgrading from 1.0.1 or earlier.
            // Converts old array into JSON object.
            if (Array.isArray(throws[index]))
            {
                throws[index] = {
                    "location": throws[index][0],
                    "weight": throws[index][1],
                    "scale": throws[index][2],
                    "sound": throws[index][3],
                    "volume": throws[index][4],
                    "enabled": throws[index][5]
                };
                setData("throws", throws);
            }

            if (fs.existsSync(__dirname + "/" + throws[index].location))
            {
                var row = document.querySelector("#imageRow").cloneNode(true);
                row.id = "";
                row.classList.add("imageRow");
                row.removeAttribute("hidden");
                row.querySelector(".imageImage").src = throws[index].location;
                document.querySelector("#imageTable").appendChild(row);

                if (throws[index].enabled == null)
                {
                    throws[index].enabled = true;
                    setData("throws", throws);
                }

                row.querySelector(".imageEnabled").checked = throws[index].enabled;
                row.querySelector(".imageEnabled").addEventListener("change", () => {
                    throws[index].enabled = row.querySelector(".imageEnabled").checked;
                    setData("throws", throws);
                });

                row.querySelector(".imageDetails").addEventListener("click", () => {
                    currentImageIndex = index;
                    openImageDetails();
                    showPanel("imageDetails");
                });
            }
            else
            {
                throws.splice(index, 1);
                setData("throws", throws);
            }
        });
    }
}

document.querySelector("#loadImageSound").addEventListener("change", loadImageSound);

async function loadImageSound()
{
    // Grab the image that was just loaded
    const imageFile = document.querySelector("#loadImageSound").files[0];
    // If the folder for objects doesn't exist for some reason, make it
    if (!fs.existsSync(__dirname + "/throws/"))
        fs.mkdirSync(__dirname + "/throws/");

    // Ensure that we're not overwriting any existing files with the same name
    // If a file already exists, add an interating number to the end until it's a unique filename
    var append = "";
    while (fs.existsSync(imageFile.path, __dirname + "/throws/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".") + 1)))
        append = append == "" ? 2 : (append + 1);
    //imageFile.name = imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".") + 1);

    // Make a copy of the file into the local folder
    fs.copyFileSync(imageFile.path, __dirname + "/throws/" + imageFile.name);
    
    // Get the existing images, add the new image, update the data, and refresh the images page
    var throws = await getData("throws");
    throws[currentImageIndex].sound = "impacts/" + soundFile.name;
    setData("throws", throws);
    
    // Reset the image upload
    document.querySelector("#loadImageSound").value = null;
    openImageDetails(currentImageIndex);
}

var currentImageIndex = -1;
async function openImageDetails()
{
    var throws = await getData("throws");
    const details = document.querySelector("#imageDetails");

    details.querySelector(".imageImage").src = throws[currentImageIndex].location;
    details.querySelector(".imageEnabled").checked = throws[currentImageIndex].enabled;
    details.querySelector(".imageWeight").value = throws[currentImageIndex].weight;
    details.querySelector(".imageScale").value = throws[currentImageIndex].scale;
    if (throws[currentImageIndex].sound != null)
    {
        details.querySelector(".imageSoundName").value = throws[currentImageIndex].sound.substr(8);
        details.querySelector(".imageSoundVolume").value = throws[currentImageIndex].volume;
        details.querySelector(".imageSoundVolume").removeAttribute("disabled");
        details.querySelector(".imageSoundRemove").removeAttribute("disabled");
    }
    else
    {
        details.querySelector(".imageSoundName").value = null;
        details.querySelector(".imageSoundVolume").value = null;
        details.querySelector(".imageSoundVolume").disabled = "disabled";
        details.querySelector(".imageSoundRemove").disabled = "disabled";
    }

    details.querySelector(".imageEnabled").addEventListener("click", () => {
        throws[currentImageIndex].enabled = details.querySelector(".imageEnabled").checked;
        setData("throws", throws);
    });

    details.querySelector(".imageWeight").addEventListener("change", () => {
        throws[currentImageIndex].weight = parseFloat(details.querySelector(".imageWeight").value);
        setData("throws", throws);
    });

    details.querySelector(".imageScale").addEventListener("change", () => {
        throws[currentImageIndex].scale = parseFloat(details.querySelector(".imageScale").value);
        setData("throws", throws);
    });

    details.querySelector(".imageRemove").addEventListener("click", () => {
        throws.splice(currentImageIndex, 1);
        setData("throws", throws);
        showPanel("images");
    });

    details.querySelector(".imageSoundVolume").addEventListener("change", () => {
        throws[currentImageIndex].volume = parseFloat(details.querySelector(".imageVolume").value);
        setData("throws", throws);
    });

    details.querySelector(".imageSoundRemove").addEventListener("click", () => {
        throws[currentImageIndex].sound = null;
        throws[currentImageIndex].volume = null;
        setData("throws", throws);
        details.querySelector(".imageSoundName").value = null;
        details.querySelector(".imageSoundVolume").value = null;
        details.querySelector(".imageSoundVolume").disabled = "disabled";
        details.querySelector(".imageSoundRemove").disabled = "disabled";
    });

}

document.querySelector("#loadSound").addEventListener("change", loadSound);

async function loadSound()
{
    const soundFile = document.querySelector("#loadSound").files[0];
    if (!fs.existsSync(__dirname + "/impacts/"))
        fs.mkdirSync(__dirname + "/impacts/");

    var append = "";
    while (fs.existsSync(imageFile.path, __dirname + "/impacts/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".") + 1)))
        append = append == "" ? 2 : (append + 1);
    imageFile.name = imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".") + 1);

    fs.copyFileSync(soundFile.path, __dirname + "/impacts/" + soundFile.name);

    var impacts = await getData("impacts");

    impacts.push({
        "location": "impacts/" + soundFile.name,
        "volume": 1.0,
        "enabled": true
    });
    setData("impacts", impacts);
    openSounds();
    
    document.querySelector("#loadSound").value = null;
}

async function openSounds()
{
    var impacts = await getData("impacts");
    
    document.querySelectorAll(".soundRow").forEach((element) => { element.remove(); });

    if (impacts == null)
        setData("impacts", []);
    else
    {
        impacts.forEach((_, index) =>
        {
            // For those upgrading from 1.0.1 or earlier.
            // Converts old array into JSON object.
            if (Array.isArray(impacts[index]))
            {
                impacts[index] = {
                    "location": impacts[index][0],
                    "volume": impacts[index][1],
                    "enabled": impacts[index][2]
                };
            }

            if (fs.existsSync(__dirname + "/" + impacts[index].location))
            {
                var row = document.querySelector("#soundRow").cloneNode(true);
                row.id = "";
                row.classList.add("soundRow");
                row.removeAttribute("hidden");
                row.querySelector(".soundName").value = impacts[index].location.substr(8);
                document.querySelector("#soundTable").appendChild(row);

                row.querySelector(".removeSound").addEventListener("click", () => {
                    impacts.splice(index, 1);
                    setData("impacts", impacts);
                    row.remove();
                });

                // For those upgrading from version 1.0.1 or earlier.
                // Sets default "enabled" value to true.
                if (impacts[index].enabled == null)
                {
                    impacts[index].enabled = true;
                    setData("impacts", impacts);
                }

                row.querySelector(".soundEnabled").checked = impacts[index].enabled;
                row.querySelector(".soundEnabled").addEventListener("change", () => {
                    impacts[index].enabled = row.querySelector(".soundEnabled").checked;
                    setData("impacts", impacts);
                });

                row.querySelector(".soundVolume").value = impacts[index].volume;
                row.querySelector(".soundVolume").addEventListener("change", () => {
                    clampValue(row.querySelector(".soundVolume"), 0, 1);
                    impacts[index].volume = parseFloat(row.querySelector(".soundVolume").value);
                    setData("impacts", impacts);
                });
            }
            else
            {
                impacts.splice(index, 1);
                setData("impacts", impacts);
            }
        });
    }
}

document.querySelector("#loadBitSound").addEventListener("change", loadBitSound);

async function loadBitSound()
{
    const soundFile = document.querySelector("#loadBitSound").files[0];
    if (!fs.existsSync(__dirname + "/bitImpacts/"))
        fs.mkdirSync(__dirname + "/bitImpacts/");

    var append = "";
    while (fs.existsSync(imageFile.path, __dirname + "/bitImpacts/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".") + 1)))
        append = append == "" ? 2 : (append + 1);
    imageFile.name = imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".") + 1);

    fs.copyFileSync(soundFile.path, __dirname + "/bitImpacts/" + soundFile.name);
    
    var bitImpacts = await getData("bitImpacts");
    bitImpacts.push({
        "location": "bitImpacts/" + soundFile.name,
        "volume": 1.0,
        "enabled": true
    });
    setData("bitImpacts", bitImpacts);
    openBitSounds();

    document.querySelector("#loadBitSound").value = null;
}

async function openBitSounds()
{
    var bitImpacts = await getData("bitImpacts");
    
    document.querySelectorAll(".bitSoundRow").forEach((element) => { element.remove(); });

    if (bitImpacts == null)
        setData("bitImpacts", []);
    else
    {
        bitImpacts.forEach((_, index) =>
        {
            // For those upgrading from 1.0.1 or earlier.
            // Converts old array into JSON object.
            if (Array.isArray(bitImpacts[index]))
            {
                bitImpacts[index] = {
                    "location": bitImpacts[index][0],
                    "volume": bitImpacts[index][1],
                    "enabled": bitImpacts[index][2]
                };
            }

            if (fs.existsSync(__dirname + "/" + bitImpacts[index].location))
            {
                var row = document.querySelector("#bitSoundRow").cloneNode(true);
                row.id = "";
                row.classList.add("bitSoundRow");
                row.removeAttribute("hidden");
                row.querySelector(".bitSoundName").value = bitImpacts[index].location.substr(11);
                document.querySelector("#bitSoundTable").appendChild(row);
    
                row.querySelector(".removeBitSound").addEventListener("click", () => {
                    bitImpacts.splice(index, 1);
                    setData("bitImpacts", bitImpacts);
                    row.remove();
                });

                if (bitImpacts[index].enabled == null)
                {
                    bitImpacts[index].enabled = true;
                    setData("bitImpacts", impacts);
                }

                row.querySelector(".bitSoundEnabled").checked = bitImpacts[index].enabled;
                row.querySelector(".bitSoundEnabled").addEventListener("change", () => {
                    bitImpacts[index].enabled = row.querySelector(".bitSoundEnabled").checked;
                    setData("bitImpacts", impacts);
                });
    
                row.querySelector(".bitSoundVolume").value = bitImpacts[index].volume;
                row.querySelector(".bitSoundVolume").addEventListener("change", () => {
                    clampValue(row.querySelector(".bitSoundVolume"), 0, 1);
                    bitImpacts[index].volume = parseFloat(row.querySelector(".bitSoundVolume").value);
                    setData("bitImpacts", bitImpacts);
                });
            }
            else
            {
                bitImpacts.splice(index, 1);
                setData("bitImpacts", bitImpacts);
            }
        });
    }
}

document.querySelector('#single').addEventListener('click', () => { ipcRenderer.send('single'); });
document.querySelector('#startCalibrate').addEventListener('click', () => { ipcRenderer.send('startCalibrate'); });
document.querySelector('#nextCalibrate').addEventListener('click', () => { ipcRenderer.send('nextCalibrate'); });
document.querySelector('#cancelCalibrate').addEventListener('click', () => { ipcRenderer.send('cancelCalibrate'); });
document.querySelector('#barrage').addEventListener('click', () => { ipcRenderer.send('barrage'); });
document.querySelector('#bits').addEventListener('click', () => { ipcRenderer.send('bits'); });
document.querySelector('#raid').addEventListener('click', () => { ipcRenderer.send('raid'); });
document.querySelector("#oAuthLink").addEventListener('click', () => { ipcRenderer.send('oauth'); });

ipcRenderer.on("status", (event, message) => { setStatus(event, message); });

async function setStatus(_, message)
{
    status = message;
    document.querySelector("#status").innerHTML = statusTitle[status];

    if (status != 5)
        document.querySelector("#statusDesc").innerHTML = statusDesc[status];
    else
        document.querySelector("#statusDesc").innerHTML = statusDesc[status][0] + await getData("portVTubeStudio") + statusDesc[status][1];

    if (status == 1)
        document.querySelector("#oAuthButton").classList.remove("hide");
    else
        document.querySelector("#oAuthButton").classList.add("hide");

    if (status == 3 || status == 4 || status == 9)
    {
        if (status == 9)
            document.querySelector("#nextCalibrate").innerText = "Start Calibration";
        else if (status == 3)
            document.querySelector("#nextCalibrate").innerText = "Continue Calibration";
        else if (status == 4)
            document.querySelector("#nextCalibrate").innerText = "Confirm Calibration";
        document.querySelector("#calibrateButtons").classList.remove("hide");
    }
    else
        document.querySelector("#calibrateButtons").classList.add("hide");
}

async function loadData(field)
{
    const thisData = await getData(field);
    if (thisData != null)
    {
        if (field.includes("Enabled"))
            document.querySelector("#" + field).checked = thisData;
        else
        {
            document.querySelector("#" + field).value = thisData;
            if (field == "portThrower" || field == "portVTubeStudio")
                setPorts();
        }
    }
    else
    {
        const node = document.querySelector("#" + field);
        const val = node.type == "checkbox" ? node.checked : (node.type == "number" ? parseFloat(node.value) : node.value);
        setData(field, val);
    }
}

window.onload = function()
{
    loadData("singleRedeemEnabled");
    loadData("barrageRedeemEnabled");
    loadData("singleCommandEnabled");
    loadData("barrageCommandEnabled");
    loadData("subEnabled");
    loadData("subGiftEnabled");
    loadData("bitsEnabled");
    loadData("raidEnabled");

    loadData("singleRedeemID");
    loadData("barrageRedeemID");

    loadData("singleCommandTitle");
    loadData("barrageCommandTitle");
    loadData("subType");
    loadData("subGiftType");
    loadData("bitsMaxBarrageCount");
    loadData("raidMaxBarrageCount");

    loadData("singleRedeemCooldown");
    loadData("barrageRedeemCooldown");
    loadData("singleCommandCooldown");
    loadData("barrageCommandCooldown");
    loadData("subCooldown");
    loadData("subGiftCooldown");
    loadData("bitsCooldown");
    loadData("raidCooldown");

    loadData("barrageCount");
    loadData("barrageFrequency");
    loadData("throwDuration");
    loadData("returnSpeed");
    loadData("throwAngleMin");
    loadData("throwAngleMax");
    loadData("closeEyes");
    loadData("openEyes");
    loadData("itemScaleMin");
    loadData("itemScaleMax");
    loadData("delay");
    loadData("volume");
    loadData("portThrower");
    loadData("portVTubeStudio");
    loadData("accessToken");
}

document.querySelector("#singleRedeemEnabled").addEventListener("change", () => setData("singleRedeemEnabled", document.querySelector("#singleRedeemEnabled").checked));
document.querySelector("#barrageRedeemEnabled").addEventListener("change", () => setData("barrageRedeemEnabled", document.querySelector("#barrageRedeemEnabled").checked));
document.querySelector("#singleCommandEnabled").addEventListener("change", () => setData("singleCommandEnabled", document.querySelector("#singleCommandEnabled").checked));
document.querySelector("#barrageCommandEnabled").addEventListener("change", () => setData("barrageCommandEnabled", document.querySelector("#barrageCommandEnabled").checked));
document.querySelector("#subEnabled").addEventListener("change", () => setData("subEnabled", document.querySelector("#subEnabled").checked));
document.querySelector("#subGiftEnabled").addEventListener("change", () => setData("subGiftEnabled", document.querySelector("#subGiftEnabled").checked));
document.querySelector("#bitsEnabled").addEventListener("change", () => setData("bitsEnabled", document.querySelector("#bitsEnabled").checked));
document.querySelector("#raidEnabled").addEventListener("change", () => setData("raidEnabled", document.querySelector("#raidEnabled").checked));

document.querySelector("#singleRedeemID").addEventListener("click", () => { ipcRenderer.send('listenSingle'); });
document.querySelector("#barrageRedeemID").addEventListener("click", () => { ipcRenderer.send('listenBarrage'); });

document.querySelector("#singleCommandTitle").addEventListener("change", () => setData("singleCommandTitle", document.querySelector("#singleCommandTitle").value));
document.querySelector("#barrageCommandTitle").addEventListener("change", () => setData("barrageCommandTitle", document.querySelector("#barrageCommandTitle").value));
document.querySelector("#subType").addEventListener("change", () => setData("subType", document.querySelector("#subType").value));
document.querySelector("#subGiftType").addEventListener("change", () => setData("subGiftType", document.querySelector("#subGiftType").value));
document.querySelector("#bitsMaxBarrageCount").addEventListener("change", () => { clampValue(document.querySelector("#bitsMaxBarrageCount"), 0, null); setData("bitsMaxBarrageCount", parseInt(document.querySelector("#bitsMaxBarrageCount").value)) });
document.querySelector("#raidMaxBarrageCount").addEventListener("change", () => { clampValue(document.querySelector("#raidMaxBarrageCount"), 0, null); setData("raidMaxBarrageCount", parseInt(document.querySelector("#raidMaxBarrageCount").value)) });

document.querySelector("#singleRedeemCooldown").addEventListener("change", () => { clampValue(document.querySelector("#singleRedeemCooldown"), 0, null); setData("singleRedeemCooldown", parseFloat(document.querySelector("#singleRedeemCooldown").value)) });
document.querySelector("#barrageRedeemCooldown").addEventListener("change", () => { clampValue(document.querySelector("#barrageRedeemCooldown"), 0, null); setData("barrageRedeemCooldown", parseFloat(document.querySelector("#barrageRedeemCooldown").value)) });
document.querySelector("#singleCommandCooldown").addEventListener("change", () => { clampValue(document.querySelector("#singleCommandCooldown"), 0, null); setData("singleCommandCooldown", parseFloat(document.querySelector("#singleCommandCooldown").value)) });
document.querySelector("#barrageCommandCooldown").addEventListener("change", () => { clampValue(document.querySelector("#barrageCommandCooldown"), 0, null); setData("barrageCommandCooldown", parseFloat(document.querySelector("#barrageCommandCooldown").value)) });
document.querySelector("#subCooldown").addEventListener("change", () => { clampValue(document.querySelector("#subCooldown"), 0, null); setData("subCooldown", parseFloat(document.querySelector("#subCooldown").value)) });
document.querySelector("#subGiftCooldown").addEventListener("change", () => { clampValue(document.querySelector("#subGiftCooldown"), 0, null); setData("subGiftCooldown", parseFloat(document.querySelector("#subGiftCooldown").value)) });
document.querySelector("#bitsCooldown").addEventListener("change", () => { clampValue(document.querySelector("#bitsCooldown"), 0, null); setData("bitsCooldown", parseFloat(document.querySelector("#bitsCooldown").value)) });
document.querySelector("#raidCooldown").addEventListener("change", () => { clampValue(document.querySelector("#raidCooldown"), 0, null); setData("raidCooldown", parseFloat(document.querySelector("#raidCooldown").value)) });

document.querySelector("#barrageCount").addEventListener("change", () => { clampValue(document.querySelector("#barrageCount"), 0, null); setData("barrageCount", parseInt(document.querySelector("#barrageCount").value)) });
document.querySelector("#barrageFrequency").addEventListener("change", () => { clampValue(document.querySelector("#barrageFrequency"), 0, null); setData("barrageFrequency", parseFloat(document.querySelector("#barrageFrequency").value)) });
document.querySelector("#throwDuration").addEventListener("change", () => { clampValue(document.querySelector("#throwDuration"), 0.5, null); setData("throwDuration", parseFloat(document.querySelector("#throwDuration").value)) });
document.querySelector("#returnSpeed").addEventListener("change", () => { clampValue(document.querySelector("#returnSpeed"), 0, null); setData("returnSpeed", parseFloat(document.querySelector("#returnSpeed").value)) });
document.querySelector("#throwAngleMin").addEventListener("change", () => { clampValue(document.querySelector("#throwAngleMin"), -90, parseFloat(document.querySelector("#throwAngleMax").value)); setData("throwAngleMin", parseFloat(document.querySelector("#throwAngleMin").value)) });
document.querySelector("#throwAngleMax").addEventListener("change", () => { clampValue(document.querySelector("#throwAngleMax"), parseFloat(document.querySelector("#throwAngleMin").value), null); setData("throwAngleMax", parseFloat(document.querySelector("#throwAngleMax").value)) });

document.querySelector("#closeEyes").addEventListener("change", () => {
    const val = document.querySelector("#closeEyes").checked;
    setData("closeEyes", val);
    if (val)
    {
        document.querySelector("#openEyes").checked = false;
        setData("openEyes", false);
    }
});

document.querySelector("#openEyes").addEventListener("change", () => {
    const val = document.querySelector("#openEyes").checked;
    setData("openEyes", val);
    if (val)
    {
        document.querySelector("#closeEyes").checked = false;
        setData("closeEyes", false);
    }
});

document.querySelector("#itemScaleMin").addEventListener("change", () => { clampValue(document.querySelector("#itemScaleMin"), 0, parseFloat(document.querySelector("#itemScaleMax").value)); setData("itemScaleMin", parseFloat(document.querySelector("#itemScaleMin").value)) });
document.querySelector("#itemScaleMax").addEventListener("change", () => { clampValue(document.querySelector("#itemScaleMax"), parseFloat(document.querySelector("#itemScaleMin").value), null); setData("itemScaleMax", parseFloat(document.querySelector("#itemScaleMax").value)) });
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

const defaultData = JSON.parse(fs.readFileSync(__dirname + "/defaultData.json", "utf8"));

async function getData(field)
{
    while (isWriting > 0)
        await new Promise(resolve => setTimeout(resolve, 10));

    if (!fs.existsSync(__dirname + "/data.json"))
        fs.writeFileSync(__dirname + "/data.json", JSON.stringify(defaultData));

    var data;
    // An error should only be thrown if the other process is in the middle of writing to the file.
    // If so, it should finish shortly and this loop will exit.
    while (data == null)
    {
        try {
            data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));
        } catch {}
    }
    data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));
    return data[field];
}

function setData(field, value)
{
    isWriting++;
    ipcRenderer.send("setData", [ field, value ]);
    
    if (field == "portThrower" || field == "portVTubeStudio")
        setPorts();
}

async function setPorts()
{
    fs.writeFileSync(__dirname + "/ports.js", "var ports = [ " + await getData("portThrower") + ", " + await getData("portVTubeStudio") + " ];");
}

document.querySelector('#HelpButton').addEventListener('click', () => { showPanel("help"); });
document.querySelector('#ImagesButton').addEventListener('click', () => { showPanel("images"); });
document.querySelector('#SoundsButton').addEventListener('click', () => { showPanel("sounds"); });
document.querySelector('#BitSoundsButton').addEventListener('click', () => { showPanel("bitSounds"); });
document.querySelector('#BonksButton').addEventListener('click', () => { showPanel("bonks"); });
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
    else if (panel == "bitSounds")
        openBitSounds();

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

// In response to raid event from main process.
// Do the HTTP request here, since it's already a browser of sorts, and send the response back.
ipcRenderer.on("raid", (event, message) => { getRaidEmotes(event, message); });
async function getRaidEmotes(_, raider)
{
  var channelEmotes = new XMLHttpRequest();
  channelEmotes.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200)
      {
          const emotes = JSON.parse(this.responseText);
          ipcRenderer.send('emotes', emotes);
      }
  };
  // Open the request and send it.
  channelEmotes.open("GET", "https://api.twitch.tv/helix/chat/emotes?broadcaster_id=" + raider, true);
  channelEmotes.setRequestHeader("Authorization", "Bearer " + await getData("accessToken"));
  channelEmotes.setRequestHeader("Client-Id", "u4rwa52hwkkgyoyow0t3gywxyv54pg");
  channelEmotes.send();
}