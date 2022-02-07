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
    "Listening for Redeem<br/>(Barrage)",
    "Waiting for Listeners...",
    "Calibration (Pre)"
];

const statusDesc = [
    "",
    "<p>Please provide a valid OAuth token. You may click the button below to generate one with the required scopes.</p><p>Once acquired, please paste it into the \"OAuth Token\" section of the Settings window.",
    "<p>Please ensure OBS is open with <mark>bonker.html</mark> as the source file of an active and enabled Browser Source.</p><p>If you changed the port(s), please refresh the Browser Source.</p>",
    "<p>Please use VTube Studio to position your model's desired impact location in the center of the window and click the <mark>Confirm Calibration</mark> button below to continue.</p><p>The browser source in OBS is displaying a guide. Please do not resize the model during this process.</p>",
    "<p>Please use VTube Studio to position your model's desired impact location in the center of the window and click the <mark>Confirm Calibration</mark> button below to continue.</p><p>The browser source in OBS is displaying a guide. Please do not resize the model during this process.</p>",
    [ "<p>Please ensure the VTube Studio API is enabled on port <mark>", "</mark> and click Allow when Karasubonk requests access.</p><p>You may need to refresh the Browser Source to get the prompt to appear again.</p>" ],
    "<p>Please use the Channel Point Reward you'd like to use for single bonks.</p><p>Click the Listen button again to cancel.</p>",
    "<p>Please use the Channel Point Reward you'd like to use for barrage bonks.</p><p>Click the Listen button again to cancel.</p>",
    "",
    "<p>Please click \"Confirm Calibration\" to start the calibration process.</p>"
];

document.querySelector("#loadImage").addEventListener("change", () => {
    const imageFile = document.querySelector("#loadImage").files[0];
    if (!fs.existsSync(__dirname + "/throws/"))
        fs.mkdirSync(__dirname + "/throws/");
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
        throws.push([ "throws/" + imageFile.name, 1.0, 1.0 ]);
        setData("throws", throws);
        openImages();
    }
    
    document.querySelector("#loadImage").value = null;
});

function openImages()
{
    document.querySelectorAll(".imageRow").forEach((element) => { element.remove(); });
    
    setTimeout(() => {
        var throws = getData("throws");
        if (throws == null)
            setData("throws", []);
        else
        {
            throws.forEach(element =>
            {
                if (fs.existsSync(__dirname + "/" + element[0]))
                {
                    var row = document.querySelector("#imageRow").cloneNode(true);
                    row.id = "";
                    row.classList.add("imageRow");
                    row.removeAttribute("hidden");
                    row.querySelector(".imageName").value = element[0].substr(7);
                    document.querySelector("#imageTable").appendChild(row);

                    row.querySelector(".removeImage").addEventListener("click", () => {
                        throws.splice(throws.indexOf(element), 1);
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

                    row.querySelector(".imageWeight").value = element[1];
                    row.querySelector(".imageScale").value = element[2];
                    if (element[3] != null)
                    {
                        if (fs.existsSync(__dirname + "/" + element[3]))
                        {
                            row.querySelector(".imageSound").value = element[3].substr(8);
                            row.querySelector(".imageSoundVolume").value = element[4];
                            row.querySelector(".imageSoundVolume").addEventListener("change", () => {
                                clampValue(row.querySelector(".imageSoundVolume"), 0, 1);
                                element[1] = parseFloat(row.querySelector(".imageSoundVolume").value);
                                setData("throws", throws);
                            });
                        }
                        else
                        {
                            row.querySelector(".imageSoundVolume").disabled = "disabled";
                            element.splice(3, 1);
                            setData("throws", throws);
                        }
                    }
                    else
                        row.querySelector(".imageSoundVolume").disabled = "disable";

                    row.querySelector(".imageWeight").addEventListener("change", () => {
                        element[1] = parseFloat(row.querySelector(".imageWeight").value);
                        setData("throws", throws);
                    });

                    row.querySelector(".imageScale").addEventListener("change", () => {
                        element[2] = parseFloat(parseFloat(row.querySelector(".imageScale").value));
                        setData("throws", throws);
                    });

                    row.querySelector(".removeSound").addEventListener("click", () => {
                        row.querySelector(".imageSound").value = "";
                        element.splice(3, 2);
                        row.querySelector(".imageSoundVolume").value = "";
                        row.querySelector(".imageSoundVolume").disabled = "disabled";
                        setData("throws", throws);
                    });

                    row.querySelector(".imageSoundLoad").addEventListener("change", () => {
                        const soundFile = row.querySelector(".imageSoundLoad").files[0];
                        fs.copyFileSync(soundFile.path, __dirname + "/impacts/" + soundFile.name);
                        row.querySelector(".imageSound").value = soundFile.name;
                        row.querySelector(".imageScale").value = 1;
                        element[3] = "impacts/" + soundFile.name;
                        element[4] = 1;
                        setData("throws", throws);
                        row.querySelector(".imageSoundVolume").value = 1;
                        row.querySelector(".imageSoundVolume").removeAttribute("disabled");
                    });
                }
                else
                {
                    throws.splice(throws.indexOf(element), 1);
                    setData("throws", throws);
                }
            });
        }
    }, 100);
}

document.querySelector("#loadSound").addEventListener("change", () => {
    const soundFile = document.querySelector("#loadSound").files[0];
    if (!fs.existsSync(__dirname + "/impacts/"))
        fs.mkdirSync(__dirname + "/impacts/");
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
    
    document.querySelector("#loadSound").value = null;
});

function openSounds()
{
    document.querySelectorAll(".soundRow").forEach((element) => { element.remove(); });
    
    setTimeout(() => {
        var impacts = getData("impacts");
        if (impacts == null)
            setData("impacts", []);
        else
        {
            impacts.forEach(element =>
            {
                if (fs.existsSync(__dirname + "/" + element[0]))
                {
                    var row = document.querySelector("#soundRow").cloneNode(true);
                    row.id = "";
                    row.classList.add("soundRow");
                    row.removeAttribute("hidden");
                    row.querySelector(".soundName").value = element[0].substr(8);
                    document.querySelector("#soundTable").appendChild(row);

                    row.querySelector(".removeSound").addEventListener("click", () => {
                        impacts.splice(impacts.indexOf(element), 1);
                        setData("impacts", impacts);
                        row.remove();
                    });

                    row.querySelector(".soundVolume").value = element[1];
                    row.querySelector(".soundVolume").addEventListener("change", () => {
                        clampValue(row.querySelector(".soundVolume"), 0, 1);
                        element[1] = parseFloat(row.querySelector(".soundVolume").value);
                        setData("impacts", impacts);
                    });
                }
                else
                {
                    impacts.splice(impacts.indexOf(element), 1);
                    setData("impacts", impacts);
                }
            });
        }
    }, 100);
}

document.querySelector("#loadBitSound").addEventListener("change", () => {
    const soundFile = document.querySelector("#loadBitSound").files[0];
    if (!fs.existsSync(__dirname + "/bitImpacts/"))
        fs.mkdirSync(__dirname + "/bitImpacts/");
    fs.copyFileSync(soundFile.path, __dirname + "/bitImpacts/" + soundFile.name);
    var bitImpacts = getData("bitImpacts");
    var contains = false;
    for (var i = 0; i < bitImpacts.length; i++)
    {
        if (bitImpacts[i][0] == "bitImpacts/" + soundFile.name)
        {
            contains = true;
            break;
        }
    }

    if (!contains)
    {
        bitImpacts.push([ "bitImpacts/" + soundFile.name, 1.0 ]);
        setData("bitImpacts", bitImpacts);
        openBitSounds();
    }

    document.querySelector("#loadBitSound").value = null;
});

function openBitSounds()
{
    document.querySelectorAll(".bitSoundRow").forEach((element) => { element.remove(); });

    setTimeout(() => {
        var bitImpacts = getData("bitImpacts");
        if (bitImpacts == null)
            setData("bitImpacts", []);
        else
        {
            bitImpacts.forEach(element =>
            {
                if (fs.existsSync(__dirname + "/" + element[0]))
                {
                    var row = document.querySelector("#bitSoundRow").cloneNode(true);
                    row.id = "";
                    row.classList.add("bitSoundRow");
                    row.removeAttribute("hidden");
                    row.querySelector(".bitSoundName").value = element[0].substr(11);
                    document.querySelector("#bitSoundTable").appendChild(row);
        
                    row.querySelector(".removeBitSound").addEventListener("click", () => {
                        bitImpacts.splice(bitImpacts.indexOf(element), 1);
                        setData("bitImpacts", bitImpacts);
                        row.remove();
                    });
        
                    row.querySelector(".bitSoundVolume").value = element[1];
                    row.querySelector(".bitSoundVolume").addEventListener("change", () => {
                        clampValue(row.querySelector(".bitSoundVolume"), 0, 1);
                        element[1] = parseFloat(row.querySelector(".bitSoundVolume").value);
                        setData("bitImpacts", bitImpacts);
                    });
                }
                else
                {
                    bitImpacts.splice(bitImpacts.indexOf(element), 1);
                    setData("bitImpacts", bitImpacts);
                }
            });
        }
    }, 100);
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

    if (status == 3 || status == 4 || status == 9)
        document.querySelector("#calibrateButtons").classList.remove("hide");
    else
        document.querySelector("#calibrateButtons").classList.add("hide");
});

function loadData(field)
{
    const thisData = getData(field);
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
        console.log(field + "," + val);
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

    loadData("singleRedeemID");
    loadData("barrageRedeemID");

    loadData("singleCommandTitle");
    loadData("barrageCommandTitle");
    loadData("subType");
    loadData("subGiftType");
    loadData("bitsMaxBarrageCount");

    loadData("singleRedeemCooldown");
    loadData("barrageRedeemCooldown");
    loadData("singleCommandCooldown");
    loadData("barrageCommandCooldown");
    loadData("subCooldown");
    loadData("subGiftCooldown");
    loadData("bitsCooldown");

    loadData("barrageCount");
    loadData("barrageFrequency");
    loadData("returnSpeed");
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
document.querySelector("#openEyes").addEventListener("change", () => { setData("openEyes", document.querySelector("#openEyes").checked) });
document.querySelector("#itemScaleMin").addEventListener("change", () => { clampValue(document.querySelector("#itemScaleMin"), 0, getData("itemScaleMax")); setData("itemScaleMin", parseFloat(document.querySelector("#itemScaleMin").value)) });
document.querySelector("#itemScaleMax").addEventListener("change", () => { clampValue(document.querySelector("#itemScaleMax"), getData("itemScaleMin"), null); setData("itemScaleMax", parseFloat(document.querySelector("#itemScaleMax").value)) });
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

function getData(field)
{
    if (!fs.existsSync(__dirname + "/data.json"))
        fs.writeFileSync(__dirname + "/data.json", JSON.stringify(defaultData));
    var data;
    while (data == null)
    {
        try {
            data = JSON.parse(fs.readFileSync(__dirname + "/data.json", "utf8"));
        } catch {}
    }
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
document.querySelector('#BitSoundsButton').addEventListener('click', () => { showPanel("bitSounds"); });
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