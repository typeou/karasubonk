const { ipcRenderer } = require("electron");
const fs = require("fs");

const version = 1.24;

// ------
// Status
// ------

var status = 0;

const statusTitle = [
    "Ready!",
    "Awaiting Authentication...",
    "Connecting to Browser Source...",
    "Calibrating (1/2)",
    "Calibrating (2/2)",
    "Connecting to VTube Studio...",
    "Listening for Redeem...",
    "Calibration",
    "Activating Event Listeners...",
    "Error: Port In Use",
    "Warning: Version Mismatch",
    "Warning: Version Mismatch",
    "Authenticating..."
];

const statusDesc = [
    "",
    "<p>Click the \"Log in\" button below to open a Twitch authentication window in your browser.</p>",
    "<p>If this message doesn't disappear after a few seconds, please refresh the KBonk Browser Source in OBS.</p><p>The KBonk Browser Source should be active with <mark>karasubonk/resources/app/bonker.html</mark> as the source file.</p><p>If you have a Custom Browser Source IP set in the settings, please ensure it is correct.</p>",
    "<p>Please use VTube Studio to position your model's head under the guide being displayed in OBS.</p><p>Your VTube Studio Source and KBonk Browser Source should be overlapping.</p><p>Press the <mark>Continue Calibration</mark> button below to continue to the next step.</p>",
    "<p>Please use VTube Studio to position your model's head under the guide being displayed in OBS.</p><p>Your VTube Studio Source and KBonk Browser Source should be overlapping.</p><p>Press the <mark>Confirm Calibration</mark> button below to finish calibration.</p>",
    [ "<p>If this message doesn't disappear after a few seconds, please refresh the KBonk Browser Source.</p><p>If that doesn't work, please ensure the VTube Studio API is enabled on port <mark>", "</mark>.</p><p>If you have a Custom VTube Studio IP set in the settings, please ensure it is correct.</p>" ],
    "<p>Please use the Channel Point Reward you'd like to use.</p>",
    "<p>This short process will decide the impact location of thrown objects.</p><p>Please click \"Start Calibration\" to start the calibration process.</p>",
    "<p>This should just take a moment.</p>",
    [ "<p>The port <mark>", "</mark> is already in use. Another process may be using this port.</p><p>Try changing the Browser Source Port in Settings, under Advanced Settings.</p><p>It should be some number between 1024 and 65535.</p>" ],
    "<p>KBonk and the Browser Source are running on different versions.</p><p>Please ensure KBonk and the Browser Source are both running from the same folder.</p>",
    "<p>No version response from Browser Source.</p><p>KBonk and the Browser Source may be running on different versions.</p><p>Please ensure KBonk and the Browser Source are both running from the same folder.</p>",
    "<p>Awaiting authentication response from browser...</p>"
];

ipcRenderer.on("username", (event, message) => {
    document.querySelector("#username").classList.add("readyText");
    document.querySelector("#username").classList.remove("errorText");
    document.querySelector("#username").innerText = message;
    document.querySelector("#logout").innerText = "Log out";
});

var userDataPath = null;
ipcRenderer.on("userDataPath", (event, message) => {
    userDataPath = message;
})
ipcRenderer.send("getUserDataPath");

document.querySelector("#logout").addEventListener("click", () => {
    ipcRenderer.send("reauthenticate");
    document.querySelector("#username").classList.remove("readyText");
    document.querySelector("#username").classList.add("errorText");
    document.querySelector("#username").innerText = "None";
    document.querySelector("#logout").innerText = "Log in";
});

document.querySelector("#itchLink a").addEventListener("click", () => { ipcRenderer.send("link"); });

ipcRenderer.on("status", (event, message) => { setStatus(event, message); });

async function setStatus(_, message)
{
    // Fix: reduce ui refresh related to status.
    // Fix: fixed last commit not working.
    // For some reason, status becomes string(??? cant figure out how), so I changed '===' to '=='
    if (status == message) return;

    status = message;
    document.querySelector("#status").innerHTML = statusTitle[status];
    document.querySelector("#headerStatusInner").innerHTML = statusTitle[status] + (status != 0 ? " (Click)" : "");

    if (status == 0)
    {
        document.querySelector("#headerStatus").classList.remove("errorText");
        document.querySelector("#headerStatus").classList.remove("workingText");
        document.querySelector("#headerStatus").classList.add("readyText");
    }
    else if (status == 9 || status == 10 || status == 11)
    {
        document.querySelector("#headerStatus").classList.add("errorText");
        document.querySelector("#headerStatus").classList.remove("workingText");
        document.querySelector("#headerStatus").classList.remove("readyText");
    }
    else
    {
        document.querySelector("#headerStatus").classList.remove("errorText");
        document.querySelector("#headerStatus").classList.add("workingText");
        document.querySelector("#headerStatus").classList.remove("readyText");
    }

    if (status == 5)
        document.querySelector("#statusDesc").innerHTML = statusDesc[status][0] + await getData("portVTubeStudio") + statusDesc[status][1];
    else if (status == 9)
        document.querySelector("#statusDesc").innerHTML = statusDesc[status][0] + await getData("portThrower") + statusDesc[status][1];
    else
        document.querySelector("#statusDesc").innerHTML = statusDesc[status];

    if (status == 3 || status == 4 || status == 7)
    {
        if (status == 7)
            document.querySelector("#nextCalibrate").querySelector(".innerTopButton").innerText = "Start Calibration";
        else if (status == 3)
            document.querySelector("#nextCalibrate").querySelector(".innerTopButton").innerText = "Continue Calibration";
        else if (status == 4)
            document.querySelector("#nextCalibrate").querySelector(".innerTopButton").innerText = "Confirm Calibration";
        document.querySelector("#calibrateButtons").classList.remove("hidden");
    }
    else
        document.querySelector("#calibrateButtons").classList.add("hidden");
}

// ---------
// Libraries
// ---------

// Adding a new image to the list
document.querySelector("#newImage").addEventListener("click", () => { document.querySelector("#loadImage").click(); });
document.querySelector("#loadImage").addEventListener("change", loadImage);

async function loadImage()
{
    var throws = await getData("throws");
    var files = document.querySelector("#loadImage").files;
    for (var i = 0; i < files.length; i++)
    {
        // Grab the image that was just loaded
        var imageFile = files[i];
        // If the folder for objects doesn't exist for some reason, make it
        if (!fs.existsSync(userDataPath + "/throws/"))
            fs.mkdirSync(userDataPath + "/throws/");

        var source = fs.readFileSync(imageFile.path);
    
        // Ensure that we're not overwriting any existing files with the same name
        // If the files have the same contents, allows the overwrite
        // If the files have different contents, add an interating number to the end until it's a unique filename or has the same contents
        var append = "";
        if (imageFile.path != userDataPath + "\\throws\\" + imageFile.name)
        {
            while (fs.existsSync(userDataPath + "/throws/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf("."))))
            {
                var target = fs.readFileSync(userDataPath + "/throws/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".")));

                if (target.equals(source))
                    append = append == "" ? 2 : (append + 1);
                else
                    break;
            }
        }
        var filename = imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf("."));
    
        // Make a copy of the file into the local folder
        fs.copyFileSync(imageFile.path, userDataPath + "/throws/" + filename);
        
        // Add the new image, update the data, and refresh the images page
        throws.unshift({
            "enabled": true,
            "location": "throws/" + filename,
            "weight": 1.0,
            "scale": 1.0,
            "sound": null,
            "volume": 1.0,
            "customs": []
        });
    }
    setData("throws", throws);
    openImages();
    copyFilesToDirectory();
    
    // Reset the image upload
    document.querySelector("#loadImage").value = null;
}

document.querySelector("#imageTable").querySelector(".selectAll input").addEventListener("change", async () => {
    document.querySelector("#imageTable").querySelectorAll(".imageEnabled").forEach((element) => { 
        element.checked = document.querySelector("#imageTable").querySelector(".selectAll input").checked;
    });
    var throws = await getData("throws");
    for (var i = 0; i < throws.length; i++)
        throws[i].enabled = document.querySelector("#imageTable").querySelector(".selectAll input").checked;
    setData("throws", throws);
});

async function openImages()
{
    var throws = await getData("throws");

    document.querySelector("#imageTable").querySelectorAll(".imageRow").forEach((element) => { element.remove(); });
    
    var allEnabled = true;
    for (var i = 0; i < throws.length; i++)
    {
        if (!throws[i].enabled)
        {
            allEnabled = false;
            break;
        }
    }
    document.querySelector("#imageTable").querySelector(".selectAll input").checked = allEnabled;

    if (throws == null)
        setData("throws", []);
    else
    {
        throws.forEach((_, index) =>
        {
            if (fs.existsSync(userDataPath + "/" + throws[index].location))
            {
                var row = document.querySelector("#imageRow").cloneNode(true);
                row.removeAttribute("id");
                row.classList.add("imageRow");
                row.removeAttribute("hidden");
                document.querySelector("#imageTable").appendChild(row);

                row.querySelector(".imageLabel").innerText = throws[index].location.substr(throws[index].location.lastIndexOf('/') + 1);
    
                row.querySelector(".imageImage").src = userDataPath + "/" + throws[index].location;

                var pixel = throws[index].pixel != null ? throws[index].pixel : false;
                row.querySelector(".imageImage").style.imageRendering = (pixel ? "pixelated" : "auto");

                row.querySelector(".imageEnabled").checked = throws[index].enabled;
                row.querySelector(".imageEnabled").addEventListener("change", () => {
                    throws[index].enabled = row.querySelector(".imageEnabled").checked;
                    setData("throws", throws);

                    var allEnabled = true;
                    for (var i = 0; i < throws.length; i++)
                    {
                        if (!throws[i].enabled)
                        {
                            allEnabled = false;
                            break;
                        }
                    }
                    document.querySelector("#imageTable").querySelector(".selectAll input").checked = allEnabled;
                });

                row.querySelector(".imageDetails").addEventListener("click", () => {
                    currentImageIndex = index;
                    openImageDetails();
                    showPanel("imageDetails", true);
                });

                row.querySelector(".imageRemove").addEventListener("click", () => {
                    throws.splice(index, 1);
                    setData("throws", throws);
                    openImages();
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

async function loadImageCustom(customName)
{
    var throws = await getData("throws");
    var files = document.querySelector("#loadImageCustom").files;
    for (var i = 0; i < files.length; i++)
    {
        // Grab the image that was just loaded
        var imageFile = files[i];
        // If the folder for objects doesn't exist for some reason, make it
        if (!fs.existsSync(userDataPath + "/throws/"))
            fs.mkdirSync(userDataPath + "/throws/");

        var source = fs.readFileSync(imageFile.path);
    
        // Ensure that we're not overwriting any existing files with the same name
        // If the files have the same contents, allows the overwrite
        // If the files have different contents, add an interating number to the end until it's a unique filename or has the same contents
        var append = "";
        if (imageFile.path != userDataPath + "\\throws\\" + imageFile.name)
        {
            while (fs.existsSync(userDataPath + "/throws/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf("."))))
            {
                var target = fs.readFileSync(userDataPath + "/throws/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".")));

                if (target.equals(source))
                    append = append == "" ? 2 : (append + 1);
                else
                    break;
            }
        }
        var filename = imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf("."));
    
        // Make a copy of the file into the local folder
        fs.copyFileSync(imageFile.path, userDataPath + "/throws/" + filename);
        
        // Add the new image, update the data, and refresh the images page
        throws.unshift({
            "enabled": false,
            "location": "throws/" + filename,
            "weight": 1.0,
            "scale": 1.0,
            "sound": null,
            "volume": 1.0,
            "customs": [ customName ]
        });
    }
    setData("throws", throws);
    openImagesCustom(customName);
    copyFilesToDirectory();
    
    // Reset the image upload
    document.querySelector("#loadImageCustom").value = null;
}

async function openImagesCustom(customName)
{
    // Refresh table to remove old event listeners
    var oldTable = document.querySelector("#imageTableCustom");
    var newTable = oldTable.cloneNode(true);
    oldTable.after(newTable);
    oldTable.remove();

    document.querySelector("#newImageCustom").addEventListener("click", () => { document.querySelector("#loadImageCustom").click(); });
    document.querySelector("#loadImageCustom").addEventListener("change", () => { loadImageCustom(customName); });
    
    var throws = await getData("throws");

    var allEnabled = true;
    for (var i = 0; i < throws.length; i++)
    {
        if (!throws[i].customs.includes(customName))
        {
            allEnabled = false;
            break;
        }
    }
    document.querySelector("#imageTableCustom").querySelector(".selectAll input").checked = allEnabled;

    document.querySelector("#imageTableCustom").querySelector(".selectAll input").addEventListener("change", () => {
        document.querySelector("#imageTableCustom").querySelectorAll(".imageEnabled").forEach((element) => { 
            element.checked = document.querySelector("#imageTableCustom").querySelector(".selectAll input").checked;
        });
        for (var i = 0; i < throws.length; i++)
        {
            if (document.querySelector("#imageTableCustom").querySelector(".selectAll input").checked && !throws[i].customs.includes(customName))
                throws[i].customs.push(customName);
            else if (!document.querySelector("#imageTableCustom").querySelector(".selectAll input").checked && throws[i].customs.includes(customName))
                throws[i].customs.splice(throws[i].customs.indexOf(customName), 1);
        }
        setData("throws", throws);
    });

    document.querySelector("#imageTableCustom").querySelectorAll(".imageRow").forEach((element) => { element.remove(); });

    if (throws == null)
        setData("throws", []);
    else
    {
        throws.forEach((_, index) =>
        {
            if (fs.existsSync(userDataPath + "/" + throws[index].location))
            {
                var row = document.querySelector("#imageRowCustom").cloneNode(true);
                row.removeAttribute("id");
                row.classList.add("imageRow");
                row.removeAttribute("hidden");
                document.querySelector("#imageTableCustom").appendChild(row);

                row.querySelector(".imageLabel").innerText = throws[index].location.substr(throws[index].location.lastIndexOf('/') + 1);
    
                row.querySelector(".imageImage").src = userDataPath + "/" + throws[index].location;

                row.querySelector(".imageEnabled").checked = throws[index].customs.includes(customName);
                row.querySelector(".imageEnabled").addEventListener("change", () => {
                    if (!row.querySelector(".imageEnabled").checked && throws[index].customs.includes(customName))
                        throws[index].customs.splice(throws[index].customs.indexOf(customName), 1);
                    else if (row.querySelector(".imageEnabled").checked && !throws[index].customs.includes(customName))
                        throws[index].customs.push(customName);
                    setData("throws", throws);

                    var allEnabled = true;
                    for (var i = 0; i < throws.length; i++)
                    {
                        if (!throws[i].customs.includes(customName))
                        {
                            allEnabled = false;
                            break;
                        }
                    }
                    document.querySelector("#imageTableCustom").querySelector(".selectAll input").checked = allEnabled;
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

async function loadSoundCustom(customName)
{
    var impacts = await getData("impacts");
    var files = document.querySelector("#loadSoundCustom").files;
    for (var i = 0; i < files.length; i++)
    {
        var soundFile = files[i];
        if (!fs.existsSync(userDataPath + "/impacts/"))
            fs.mkdirSync(userDataPath + "/impacts/");

        var source = fs.readFileSync(soundFile.path);
    
        // Ensure that we're not overwriting any existing files with the same name
        // If the files have the same contents, allows the overwrite
        // If the files have different contents, add an interating number to the end until it's a unique filename or has the same contents
        var append = "";
        if (soundFile.path != userDataPath + "\\impacts\\" + soundFile.name)
        {
            while (fs.existsSync(userDataPath + "/impacts/" + soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf("."))))
            {
                var target = fs.readFileSync(userDataPath + "/impacts/" + soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf(".")));

                if (target.equals(source))
                    append = append == "" ? 2 : (append + 1);
                else
                    break;
            }
        }
        var filename = soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf("."));

        fs.copyFileSync(soundFile.path, userDataPath + "/impacts/" + filename);

        impacts.unshift({
            "location": "impacts/" + filename,
            "volume": 1.0,
            "enabled": false,
            "customs": [ customName ]
        });
    }
    setData("impacts", impacts);
    openSoundsCustom(customName);
    copyFilesToDirectory();
    
    document.querySelector("#loadSoundCustom").value = null;
}

async function openSoundsCustom(customName)
{
    // Refresh table to remove old event listeners
    var oldTable = document.querySelector("#soundTableCustom");
    var newTable = oldTable.cloneNode(true);
    oldTable.after(newTable);
    oldTable.remove();

    document.querySelector("#newSoundCustom").addEventListener("click", () => { document.querySelector("#loadSoundCustom").click(); });
    document.querySelector("#loadSoundCustom").addEventListener("change", () => { loadSoundCustom(customName); });

    var impacts = await getData("impacts");

    var allEnabled = true;
    for (var i = 0; i < impacts.length; i++)
    {
        if (!impacts[i].customs.includes(customName))
        {
            allEnabled = false;
            break;
        }
    }
    document.querySelector("#soundTableCustom").querySelector(".selectAll input").checked = allEnabled;

    document.querySelector("#soundTableCustom").querySelector(".selectAll input").addEventListener("change", () => {
        document.querySelector("#soundTableCustom").querySelectorAll(".imageEnabled").forEach((element) => { 
            element.checked = document.querySelector("#soundTableCustom").querySelector(".selectAll input").checked;
        });
        for (var i = 0; i < impacts.length; i++)
        {
            if (document.querySelector("#soundTableCustom").querySelector(".selectAll input").checked && !impacts[i].customs.includes(customName))
                impacts[i].customs.push(customName);
            else if (!document.querySelector("#soundTableCustom").querySelector(".selectAll input").checked && impacts[i].customs.includes(customName))
                impacts[i].customs.splice(impacts[i].customs.indexOf(customName), 1);
        }
        setData("impacts", impacts);
    });
    
    document.querySelector("#soundTableCustom").querySelectorAll(".soundRow").forEach((element) => { element.remove(); });

    if (impacts == null)
        setData("impacts", []);
    else
    {
        impacts.forEach((_, index) =>
        {
            if (fs.existsSync(userDataPath + "/" + impacts[index].location))
            {
                var row = document.querySelector("#soundRowCustom").cloneNode(true);
                row.removeAttribute("id");
                row.classList.add("soundRow");
                row.removeAttribute("hidden");
                row.querySelector(".imageLabel").innerText = impacts[index].location.substr(impacts[index].location.lastIndexOf('/') + 1);
                document.querySelector("#soundTableCustom").appendChild(row);

                row.querySelector(".imageEnabled").checked = impacts[index].customs.includes(customName);
                row.querySelector(".imageEnabled").addEventListener("change", () => {
                    if (!row.querySelector(".imageEnabled").checked && impacts[index].customs.includes(customName))
                        impacts[index].customs.splice(impacts[index].customs.indexOf(customName), 1);
                    else if (row.querySelector(".imageEnabled").checked && !impacts[index].customs.includes(customName))
                        impacts[index].customs.push(customName);
                    setData("impacts", impacts);

                    for (var i = 0; i < impacts.length; i++)
                    {
                        if (!impacts[i].customs.includes(customName))
                        {
                            allEnabled = false;
                            break;
                        }
                    }
                    document.querySelector("#soundTableCustom").querySelector(".selectAll input").checked = allEnabled;
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

async function loadImpactDecal(customName)
{
    var customBonks = await getData("customBonks");
    var files = document.querySelector("#loadImpactDecal").files;
    for (var i = 0; i < files.length; i++)
    {
        var imageFile = files[i];
        if (!fs.existsSync(userDataPath + "/decals/"))
            fs.mkdirSync(userDataPath + "/decals/");

        var source = fs.readFileSync(imageFile.path);
    
        // Ensure that we're not overwriting any existing files with the same name
        // If the files have the same contents, allows the overwrite
        // If the files have different contents, add an interating number to the end until it's a unique filename or has the same contents
        var append = "";
        if (imageFile.path != userDataPath + "\\decals\\" + imageFile.name)
        {
            while (fs.existsSync(userDataPath + "/decals/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf("."))))
            {
                var target = fs.readFileSync(userDataPath + "/decals/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf(".")));

                if (target.equals(source))
                    append = append == "" ? 2 : (append + 1);
                else
                    break;
            }
        }
        var filename = imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf("."));

        fs.copyFileSync(imageFile.path, userDataPath + "/decals/" + filename);

        customBonks[customName].impactDecals.unshift({
            "location": "decals/" + filename,
            "duration": 0.25,
            "scale": 1,
            "enabled": true
        });
    }
    setData("customBonks", customBonks);
    openImpactDecals(customName);
    copyFilesToDirectory();
    
    document.querySelector("#loadImpactDecal").value = null;
}

async function openImpactDecals(customName)
{
    // Refresh table to remove old event listeners
    var oldTable = document.querySelector("#impactDecalsTable");
    var newTable = oldTable.cloneNode(true);
    oldTable.after(newTable);
    oldTable.remove();

    document.querySelector("#newImpactDecal").addEventListener("click", () => { document.querySelector("#loadImpactDecal").click(); });
    document.querySelector("#loadImpactDecal").addEventListener("change", () => { loadImpactDecal(customName) });

    var customBonks = await getData("customBonks");

    var allEnabled = true;
    for (var i = 0; i < customBonks[customName].impactDecals.length; i++)
    {
        if (!customBonks[customName].impactDecals[i].enabled)
        {
            allEnabled = false;
            break;
        }
    }
    document.querySelector("#impactDecalsTable").querySelector(".selectAll input").checked = allEnabled;

    document.querySelector("#impactDecalsTable").querySelector(".selectAll input").addEventListener("change", async () => {
        document.querySelector("#impactDecalsTable").querySelectorAll(".imageEnabled").forEach((element) => { 
            element.checked = document.querySelector("#impactDecalsTable").querySelector(".selectAll input").checked;
        });
        for (var i = 0; i < customBonks[customName].impactDecals.length; i++)
            customBonks[customName].impactDecals[i].enabled = document.querySelector("#impactDecalsTable").querySelector(".selectAll input").checked;
        setData("customBonks", customBonks);
    });
    
    document.querySelector("#impactDecalsTable").querySelectorAll(".imageRow").forEach((element) => { element.remove(); });

    customBonks[customName].impactDecals.forEach((_, index) =>
    {
        if (fs.existsSync(userDataPath + "/" + customBonks[customName].impactDecals[index].location))
        {
            var row = document.querySelector("#impactDecalRow").cloneNode(true);
            row.removeAttribute("id");
            row.classList.add("imageRow");
            row.removeAttribute("hidden");
            row.querySelector(".imageLabel").innerText = customBonks[customName].impactDecals[index].location.substr(customBonks[customName].impactDecals[index].location.lastIndexOf('/') + 1);
            document.querySelector("#impactDecalsTable").appendChild(row);

            row.querySelector(".imageImage").src = userDataPath + "/" + customBonks[customName].impactDecals[index].location;

            row.querySelector(".imageRemove").addEventListener("click", () => {
                customBonks[customName].impactDecals.splice(index, 1);
                setData("customBonks", customBonks);
                openImpactDecals(customName);
            });

            row.querySelector(".imageEnabled").checked = customBonks[customName].impactDecals[index].enabled;
            row.querySelector(".imageEnabled").addEventListener("change", () => {
                customBonks[customName].impactDecals[index].enabled = row.querySelector(".imageEnabled").checked;
                setData("customBonks", customBonks);

                var allEnabled = true;
                for (var i = 0; i < customBonks[customName].impactDecals.length; i++)
                {
                    if (!customBonks[customName].impactDecals[i].enabled)
                    {
                        allEnabled = false;
                        break;
                    }
                }
                document.querySelector("#impactDecalsTable").querySelector(".selectAll input").checked = allEnabled;
            });

            row.querySelector(".decalDuration").value = customBonks[customName].impactDecals[index].duration;
            row.querySelector(".decalDuration").addEventListener("change", () => {
                clampValue(row.querySelector(".decalDuration").value, 0, null);
                customBonks[customName].impactDecals[index].duration = parseFloat(row.querySelector(".decalDuration").value);
                setData("customBonks", customBonks);
            });

            row.querySelector(".decalScale").value = customBonks[customName].impactDecals[index].scale;
            row.querySelector(".decalScale").addEventListener("change", () => {
                clampValue(row.querySelector(".decalScale"), 0, null);
                customBonks[customName].impactDecals[index].scale = parseFloat(row.querySelector(".decalScale").value);
                setData("customBonks", customBonks);
            });
        }
        else
        {
            customBonks[customName].impactDecals.splice(index, 1);
            setData("customBonks", customBonks);
        }
    });
}

async function loadWindupSound(customName)
{
    var customBonks = await getData("customBonks");
    var files = document.querySelector("#loadWindupSound").files;
    for (var i = 0; i < files.length; i++)
    {
        var soundFile = files[i];
        if (!fs.existsSync(userDataPath + "/windups/"))
            fs.mkdirSync(userDataPath + "/windups/");

        var source = fs.readFileSync(soundFile.path);
    
        // Ensure that we're not overwriting any existing files with the same name
        // If the files have the same contents, allows the overwrite
        // If the files have different contents, add an interating number to the end until it's a unique filename or has the same contents
        var append = "";
        if (soundFile.path != userDataPath + "\\windups\\" + soundFile.name)
        {
            while (fs.existsSync(userDataPath + "/windups/" + soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf("."))))
            {
                var target = fs.readFileSync(userDataPath + "/windups/" + soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf(".")));

                if (target.equals(source))
                    append = append == "" ? 2 : (append + 1);
                else
                    break;
            }
        }
        var filename = soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf("."));

        fs.copyFileSync(soundFile.path, userDataPath + "/windups/" + filename);

        customBonks[customName].windupSounds.unshift({
            "location": "windups/" + filename,
            "volume": 1.0,
            "enabled": true
        });
    }
    setData("customBonks", customBonks);
    openWindupSounds(customName);
    copyFilesToDirectory();
    
    document.querySelector("#loadWindupSound").value = null;
}

async function openWindupSounds(customName)
{
    // Refresh table to remove old event listeners
    var oldTable = document.querySelector("#windupSoundTable");
    var newTable = oldTable.cloneNode(true);
    oldTable.after(newTable);
    oldTable.remove();

    document.querySelector("#newWindupSound").addEventListener("click", () => { document.querySelector("#loadWindupSound").click(); });
    document.querySelector("#loadWindupSound").addEventListener("change", () => { loadWindupSound(customName) });

    var customBonks = await getData("customBonks");

    var allEnabled = true;
    for (var i = 0; i < customBonks[customName].windupSounds.length; i++)
    {
        if (!customBonks[customName].windupSounds[i].enabled)
        {
            allEnabled = false;
            break;
        }
    }
    document.querySelector("#windupSoundTable").querySelector(".selectAll input").checked = allEnabled;

    document.querySelector("#windupSoundTable").querySelector(".selectAll input").addEventListener("change", async () => {
        document.querySelector("#windupSoundTable").querySelectorAll(".imageEnabled").forEach((element) => { 
            element.checked = document.querySelector("#windupSoundTable").querySelector(".selectAll input").checked;
        });
        for (var i = 0; i < customBonks[customName].windupSounds.length; i++)
            customBonks[customName].windupSounds[i].enabled = document.querySelector("#windupSoundTable").querySelector(".selectAll input").checked;
        setData("customBonks", customBonks);
    });
    
    document.querySelector("#windupSoundTable").querySelectorAll(".soundRow").forEach((element) => { element.remove(); });

    customBonks[customName].windupSounds.forEach((_, index) =>
    {
        if (fs.existsSync(userDataPath + "/" + customBonks[customName].windupSounds[index].location))
        {
            var row = document.querySelector("#windupSoundRow").cloneNode(true);
            row.removeAttribute("id");
            row.classList.add("soundRow");
            row.removeAttribute("hidden");
            row.querySelector(".imageLabel").innerText = customBonks[customName].windupSounds[index].location.substr(customBonks[customName].windupSounds[index].location.lastIndexOf('/') + 1);
            document.querySelector("#windupSoundTable").appendChild(row);

            row.querySelector(".imageRemove").addEventListener("click", () => {
                customBonks[customName].windupSounds.splice(index, 1);
                setData("customBonks", customBonks);
                openWindupSounds(customName);
            });

            row.querySelector(".imageEnabled").checked = customBonks[customName].windupSounds[index].enabled;
            row.querySelector(".imageEnabled").addEventListener("change", () => {
                customBonks[customName].windupSounds[index].enabled = row.querySelector(".imageEnabled").checked;
                setData("customBonks", customBonks);

                var allEnabled = true;
                for (var i = 0; i < customBonks[customName].windupSounds.length; i++)
                {
                    if (!customBonks[customName].windupSounds[i].enabled)
                    {
                        allEnabled = false;
                        break;
                    }
                }
                document.querySelector("#windupSoundTable").querySelector(".selectAll input").checked = allEnabled;
            });

            row.querySelector(".soundVolume").value = customBonks[customName].windupSounds[index].volume;
            row.querySelector(".soundVolume").addEventListener("change", () => {
                clampValue(row.querySelector(".soundVolume"), 0, 1);
                customBonks[customName].windupSounds[index].volume = parseFloat(row.querySelector(".soundVolume").value);
                setData("customBonks", customBonks);
            });
        }
        else
        {
            customBonks[customName].windupSounds.splice(index, 1);
            setData("customBonks", customBonks);
        }
    });
}

document.querySelector("#bit1").querySelector(".bitImageScale").addEventListener("change", async () => {
    var bitThrows = await getData("bitThrows");
    bitThrows.one.scale = parseFloat(document.querySelector("#bit1").querySelector(".bitImageScale").value);
    setData("bitThrows", bitThrows);
});
document.querySelector("#bitImageAdd1").addEventListener("click", () => { document.querySelector("#loadBitImageone").click(); });
document.querySelector("#loadBitImageone").addEventListener("change", () => { loadBitImage("one") });

document.querySelector("#bit100").querySelector(".bitImageScale").addEventListener("change", async () => {
    var bitThrows = await getData("bitThrows");
    bitThrows.oneHundred.scale = parseFloat(document.querySelector("#bit100").querySelector(".bitImageScale").value);
    setData("bitThrows", bitThrows);
});
document.querySelector("#bitImageAdd100").addEventListener("click", () => { document.querySelector("#loadBitImageoneHundred").click(); });
document.querySelector("#loadBitImageoneHundred").addEventListener("change", () => { loadBitImage("oneHundred") });

document.querySelector("#bit1000").querySelector(".bitImageScale").addEventListener("change", async () => {
    var bitThrows = await getData("bitThrows");
    bitThrows.oneThousand.scale = parseFloat(document.querySelector("#bit1000").querySelector(".bitImageScale").value);
    setData("bitThrows", bitThrows);
});
document.querySelector("#bitImageAdd1000").addEventListener("click", () => { document.querySelector("#loadBitImageoneThousand").click(); });
document.querySelector("#loadBitImageoneThousand").addEventListener("change", () => { loadBitImage("oneThousand") });

document.querySelector("#bit5000").querySelector(".bitImageScale").addEventListener("change", async () => {
    var bitThrows = await getData("bitThrows");
    bitThrows.fiveThousand.scale = parseFloat(document.querySelector("#bit5000").querySelector(".bitImageScale").value);
    setData("bitThrows", bitThrows);
});
document.querySelector("#bitImageAdd5000").addEventListener("click", () => { document.querySelector("#loadBitImagefiveThousand").click(); });
document.querySelector("#loadBitImagefiveThousand").addEventListener("change", () => { loadBitImage("fiveThousand") });

document.querySelector("#bit10000").querySelector(".bitImageScale").addEventListener("change", async () => {
    var bitThrows = await getData("bitThrows");
    bitThrows.tenThousand.scale = parseFloat(document.querySelector("#bit10000").querySelector(".bitImageScale").value);
    setData("bitThrows", bitThrows);
});
document.querySelector("#bitImageAdd10000").addEventListener("click", () => { document.querySelector("#loadBitImagetenThousand").click(); });
document.querySelector("#loadBitImagetenThousand").addEventListener("change", () => { loadBitImage("tenThousand") });

async function loadBitImage(key)
{
    var bitThrows = await getData("bitThrows");
    var files = document.querySelector("#loadBitImage" + key).files;
    // Grab the image that was just loaded
    var imageFile = files[0];
    // If the folder for objects doesn't exist for some reason, make it
    if (!fs.existsSync(userDataPath + "/throws/"))
        fs.mkdirSync(userDataPath + "/throws/");

    // Ensure that we're not overwriting any existing files with the same name
    // If a file already exists, add an interating number to the end until it"s a unique filename
    var append = "";
    if (imageFile.path != userDataPath + "\\throws\\" + imageFile.name)
        while (fs.existsSync(userDataPath + "/throws/" + imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf("."))))
            append = append == "" ? 2 : (append + 1);
    var filename = imageFile.name.substr(0, imageFile.name.lastIndexOf(".")) + append + imageFile.name.substr(imageFile.name.lastIndexOf("."));

    // Make a copy of the file into the local folder
    fs.copyFileSync(imageFile.path, userDataPath + "/throws/" + filename);
    
    // Add the new image, update the data, and refresh the images page
    bitThrows[key].location = "throws/" + filename;
    setData("bitThrows", bitThrows);
    openBitImages();
    copyFilesToDirectory();
    
    // Reset the image upload
    document.querySelector("#loadBitImage" + key).value = null;
}

async function openBitImages()
{
    var bitThrows = await getData("bitThrows");

    if (bitThrows == null)
    {
        bitThrows = defaultData.bitThrows;
        setData("bitThrows", bitThrows);
    }

    document.querySelector("#bit1").querySelector(".imageImage").src = userDataPath + "/" + bitThrows.one.location;
    document.querySelector("#bit1").querySelector(".bitImageScale").value = bitThrows.one.scale;

    document.querySelector("#bit100").querySelector(".imageImage").src = userDataPath + "/" + bitThrows.oneHundred.location;
    document.querySelector("#bit100").querySelector(".bitImageScale").value = bitThrows.oneHundred.scale;

    document.querySelector("#bit1000").querySelector(".imageImage").src = userDataPath + "/" + bitThrows.oneThousand.location;
    document.querySelector("#bit1000").querySelector(".bitImageScale").value = bitThrows.oneThousand.scale;

    document.querySelector("#bit5000").querySelector(".imageImage").src = userDataPath + "/" + bitThrows.fiveThousand.location;
    document.querySelector("#bit5000").querySelector(".bitImageScale").value = bitThrows.fiveThousand.scale;

    document.querySelector("#bit10000").querySelector(".imageImage").src = userDataPath + "/" + bitThrows.tenThousand.location;
    document.querySelector("#bit10000").querySelector(".bitImageScale").value = bitThrows.tenThousand.scale;
}

document.querySelector("#loadImageSound").addEventListener("change", loadImageSound);

async function loadImageSound()
{
    // Grab the image that was just loaded
    var soundFile = document.querySelector("#loadImageSound").files[0];
    // If the folder for objects doesn"t exist for some reason, make it
    if (!fs.existsSync(userDataPath + "/impacts/"))
        fs.mkdirSync(userDataPath + "/impacts/");

    // Ensure that we're not overwriting any existing files with the same name
    // If a file already exists, add an interating number to the end until it"s a unique filename
    var append = "";
    if (soundFile.path != userDataPath + "\\impacts\\" + soundFile.name)
        while (fs.existsSync( userDataPath + "/impacts/" + soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf("."))))
            append = append == "" ? 2 : (append + 1);
    var filename = soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf("."));

    // Make a copy of the file into the local folder
    fs.copyFileSync(soundFile.path, userDataPath + "/impacts/" + filename);
    
    // Get the existing images, add the new image, update the data, and refresh the images page
    var throws = await getData("throws");
    throws[currentImageIndex].sound = "impacts/" + filename;
    setData("throws", throws);
    
    // Reset the image upload
    document.querySelector("#loadImageSound").value = null;
    openImageDetails(currentImageIndex);
    copyFilesToDirectory();
}

var currentImageIndex = -1;
async function openImageDetails()
{
    var throws = await getData("throws");

    // Refresh nodes to remove old listeners
    var oldButton = document.querySelector("#testImage");
    var newButton = document.querySelector("#testImage").cloneNode(true);
    oldButton.after(newButton);
    oldButton.remove();

    var oldTable = document.querySelector("#testImage");
    var newTable = oldTable.cloneNode(true);
    oldTable.after(newTable);
    oldTable.remove();

    document.querySelector("#testImage").addEventListener("click", () => testItem(currentImageIndex));

    const details = document.querySelector("#imageDetails");

    details.querySelector(".imageLabel").innerText = throws[currentImageIndex].location.substr(throws[currentImageIndex].location.lastIndexOf('/') + 1);

    details.querySelector(".imageImage").src = userDataPath + "/" + throws[currentImageIndex].location;
    details.querySelector(".imageImage").style.transform = "scale(" + throws[currentImageIndex].scale + ")";
    details.querySelector(".imageWeight").value = throws[currentImageIndex].weight;
    details.querySelector(".imageScale").value = throws[currentImageIndex].scale;

    if (throws[currentImageIndex].pixel == null)
        throws[currentImageIndex].pixel = false;
    details.querySelector(".imagePixel").checked = throws[currentImageIndex].pixel;
    details.querySelector(".imageImage").style.imageRendering = (throws[currentImageIndex].pixel ? "pixelated" : "auto");

    if (throws[currentImageIndex].sound != null)
    {
        details.querySelector(".imageSoundName").value = throws[currentImageIndex].sound.substr(8);
        details.querySelector(".imageSoundRemove").removeAttribute("disabled");
    }
    else
    {
        details.querySelector(".imageSoundName").value = null;
        details.querySelector(".imageSoundRemove").disabled = "disabled";
    }

    details.querySelector(".imageWeight").addEventListener("change", () => {
        throws[currentImageIndex].weight = parseFloat(details.querySelector(".imageWeight").value);
        setData("throws", throws);
    });

    details.querySelector(".imageScale").addEventListener("change", () => {
        throws[currentImageIndex].scale = parseFloat(details.querySelector(".imageScale").value);
        details.querySelector(".imageImage").style.transform = "scale(" + throws[currentImageIndex].scale + ")";
        setData("throws", throws);
    });

    details.querySelector(".imagePixel").addEventListener("change", () => {
        throws[currentImageIndex].pixel = details.querySelector(".imagePixel").checked;
        details.querySelector(".imageImage").style.imageRendering = (throws[currentImageIndex].pixel ? "pixelated" : "auto");
        setData("throws", throws);
    });

    details.querySelector(".imageSoundVolume").value = throws[currentImageIndex].volume;
    details.querySelector(".imageSoundVolume").addEventListener("change", () => {
        throws[currentImageIndex].volume = parseFloat(details.querySelector(".imageSoundVolume").value);
        setData("throws", throws);
    });

    details.querySelector(".imageSoundRemove").addEventListener("click", () => {
        throws[currentImageIndex].sound = null;
        setData("throws", throws);
        details.querySelector(".imageSoundName").value = null;
        details.querySelector(".imageSoundRemove").disabled = "disabled";
    });

}

document.querySelector("#newSound").addEventListener("click", () => { document.querySelector("#loadSound").click(); });
document.querySelector("#loadSound").addEventListener("change", loadSound);

async function loadSound()
{
    var impacts = await getData("impacts");
    var files = document.querySelector("#loadSound").files;
    for (var i = 0; i < files.length; i++)
    {
        var soundFile = files[i];
        if (!fs.existsSync(userDataPath + "/impacts/"))
            fs.mkdirSync(userDataPath + "/impacts/");

        var append = "";
        if (soundFile.path != userDataPath + "\\impacts\\" + soundFile.name)
            while (fs.existsSync( userDataPath + "/impacts/" + soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf("."))))
                append = append == "" ? 2 : (append + 1);
        var filename = soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf("."));

        fs.copyFileSync(soundFile.path, userDataPath + "/impacts/" + filename);

        impacts.unshift({
            "location": "impacts/" + filename,
            "volume": 1.0,
            "enabled": true,
            "bits": true,
            "customs": []
        });
    }
    setData("impacts", impacts);
    openSounds();
    copyFilesToDirectory();
    
    document.querySelector("#loadSound").value = null;
}

document.querySelector("#soundTable").querySelector(".selectAll input").addEventListener("change", async () => {
    document.querySelector("#soundTable").querySelectorAll(".imageEnabled").forEach((element) => { 
        element.checked = document.querySelector("#soundTable").querySelector(".selectAll input").checked;
    });
    var impacts = await getData("impacts");
    for (var i = 0; i < impacts.length; i++)
        impacts[i].enabled = document.querySelector("#soundTable").querySelector(".selectAll input").checked;
    setData("impacts", impacts);
});

async function openSounds()
{
    var impacts = await getData("impacts");
    
    document.querySelector("#soundTable").querySelectorAll(".soundRow").forEach((element) => { element.remove(); });

    if (impacts == null)
        setData("impacts", []);
    else
    {
        impacts.forEach((_, index) =>
        {
            if (fs.existsSync(userDataPath + "/" + impacts[index].location))
            {
                var row = document.querySelector("#soundRow").cloneNode(true);
                row.removeAttribute("id");
                row.classList.add("soundRow");
                row.removeAttribute("hidden");
                row.querySelector(".imageLabel").innerText = impacts[index].location.substr(impacts[index].location.lastIndexOf('/') + 1);
                document.querySelector("#soundTable").appendChild(row);

                row.querySelector(".imageRemove").addEventListener("click", () => {
                    impacts.splice(index, 1);
                    setData("impacts", impacts);
                    openSounds();
                });

                row.querySelector(".imageEnabled").checked = impacts[index].enabled;
                row.querySelector(".imageEnabled").addEventListener("change", () => {
                    impacts[index].enabled = row.querySelector(".imageEnabled").checked;
                    setData("impacts", impacts);

                    var allEnabled = true;
                    for (var i = 0; i < impacts.length; i++)
                    {
                        if (!impacts[i].enabled)
                        {
                            allEnabled = false;
                            break;
                        }
                    }
                    document.querySelector("#soundTable").querySelector(".selectAll input").checked = allEnabled;
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

document.querySelector("#newBitSound").addEventListener("click", () => { document.querySelector("#loadBitSound").click(); });
document.querySelector("#loadBitSound").addEventListener("change", loadBitSound);

async function loadBitSound()
{
    var impacts = await getData("impacts");
    var files = document.querySelector("#loadBitSound").files;
    for (var i = 0; i < files.length; i++)
    {
        var soundFile = files[i];
        if (!fs.existsSync(userDataPath + "/impacts/"))
            fs.mkdirSync(userDataPath + "/impacts/");

        var append = "";
        while (fs.existsSync(userDataPath + "/impacts/" + soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf("."))))
            append = append == "" ? 2 : (append + 1);
        var filename = soundFile.name.substr(0, soundFile.name.lastIndexOf(".")) + append + soundFile.name.substr(soundFile.name.lastIndexOf("."));

        fs.copyFileSync(soundFile.path, userDataPath + "/impacts/" + filename);
        
        impacts.unshift({
            "location": "impacts/" + filename,
            "volume": 1.0,
            "enabled": false,
            "bits": true,
            "customs": []
        });
    }
    setData("impacts", impacts);
    openBitSounds();
    copyFilesToDirectory();

    document.querySelector("#loadBitSound").value = null;
}

document.querySelector("#bitSoundTable").querySelector(".selectAll input").addEventListener("change", async () => {
    document.querySelector("#bitSoundTable").querySelectorAll(".imageEnabled").forEach((element) => { 
        element.checked = document.querySelector("#bitSoundTable").querySelector(".selectAll input").checked;
    });
    var impacts = await getData("impacts");
    for (var i = 0; i < impacts.length; i++)
        impacts[i].bits = document.querySelector("#bitSoundTable").querySelector(".selectAll input").checked;
    setData("impacts", impacts);
});

async function openBitSounds()
{
    var impacts = await getData("impacts");
    
    document.querySelectorAll(".bitSoundRow").forEach((element) => { element.remove(); });

    if (impacts == null)
        setData("impacts", []);
    else
    {
        impacts.forEach((_, index) =>
        {
            if (fs.existsSync(userDataPath + "/" + impacts[index].location))
            {
                var row = document.querySelector("#bitSoundRow").cloneNode(true);
                row.removeAttribute("id");
                row.classList.add("bitSoundRow");
                row.removeAttribute("hidden");
                row.querySelector(".imageLabel").innerText = impacts[index].location.substr(impacts[index].location.lastIndexOf('/') + 1);
                document.querySelector("#bitSoundTable").appendChild(row);

                row.querySelector(".imageEnabled").checked = impacts[index].bits;
                row.querySelector(".imageEnabled").addEventListener("change", () => {
                    impacts[index].bits = row.querySelector(".imageEnabled").checked;
                    setData("impacts", impacts);

                    var allEnabled = true;
                    for (var i = 0; i < impacts.length; i++)
                    {
                        if (!impacts[i].bits)
                        {
                            allEnabled = false;
                            break;
                        }
                    }
                    document.querySelector("#bitSoundTable").querySelector(".selectAll input").checked = allEnabled;
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

document.querySelector("#bonksAdd").addEventListener("click", addBonk);

async function addBonk()
{
    var newBonkNumber = 1;
    var customBonks = await getData("customBonks");
    if (customBonks == null)
        customBonks = {};
    
    while (customBonks["Custom Bonk " + newBonkNumber] != null)
        newBonkNumber++;

    customBonks["Custom Bonk " + newBonkNumber] = {
        "barrageCount": 1,
        "barrageFrequencyOverride": false,
        "barrageFrequency": await getData("barrageFrequency"),
        "throwDurationOverride": false,
        "throwDuration": await getData("throwDuration"),
        "throwAngleOverride": false,
        "throwAngleMin": await getData("throwAngleMin"),
        "throwAngleMax": await getData("throwAngleMax"),
        "throwDirectionOverride": false,
        "throwDirection": await getData("throwDirection"),
        "spinSpeedMin": await getData("spinSpeedMin"),
        "spinSpeedMax": await getData("spinSpeedMax"),
        "itemsOverride": false,
        "soundsOverride": false,
        "impactDecals": [],
        "windupSounds": [],
        "windupDelay": 0
    };

    setData("customBonks", customBonks);

    var throws = await getData("throws");
    for (var i = 0; i < throws.length; i++)
        if (throws[i].enabled)
            throws[i].customs.push("Custom Bonk " + newBonkNumber);
    setData("throws", throws);

    var impacts = await getData("impacts");
    for (var i = 0; i < impacts.length; i++)
        if (impacts[i].enabled)
            impacts[i].customs.push("Custom Bonk " + newBonkNumber);
    setData("impacts", impacts);
    
    openBonks();
}

async function bonkDetails(customBonkName)
{
    var customBonks = await getData("customBonks");

    if (customBonks[customBonkName] != null)
    {
        showPanel("bonkDetails", true);

        // Copy new elements to remove all old listeners
        var oldTable = document.querySelector("#bonkDetailsTable");
        var newTable = oldTable.cloneNode(true);
        oldTable.after(newTable);
        oldTable.remove();

        const bonkDetailsTable = document.querySelector("#bonkDetailsTable");

        // Bonk Name
        bonkDetailsTable.querySelector(".bonkName").value = customBonkName;
        bonkDetailsTable.querySelector(".bonkName").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            if (customBonks[bonkDetailsTable.querySelector(".bonkName").value] == null)
            {
                customBonks[bonkDetailsTable.querySelector(".bonkName").value] = customBonks[customBonkName];
                delete customBonks[customBonkName];

                var throws = await getData("throws");
                for (var i = 0; i < throws.length; i++)
                {
                    if (throws[i].customs.includes(customBonkName))
                    {
                        throws[i].customs.splice(throws[i].customs.indexOf(customBonkName), 1);
                        throws[i].customs.push(bonkDetailsTable.querySelector(".bonkName").value);
                    }
                }
                setData("throws", throws);

                var impacts = await getData("impacts");
                for (var i = 0; i < impacts.length; i++)
                {
                    if (impacts[i].customs.includes(customBonkName))
                    {
                        impacts[i].customs.splice(impacts[i].customs.indexOf(customBonkName), 1);
                        impacts[i].customs.push(bonkDetailsTable.querySelector(".bonkName").value);
                    }
                }
                setData("impacts", impacts);

                customBonkName = bonkDetailsTable.querySelector(".bonkName").value;
            }
            else
            {
                // Error: Name exists
            }
            setData("customBonks", customBonks);
        });

        // Barrage Count
        bonkDetailsTable.querySelector(".barrageCount").value = customBonks[customBonkName].barrageCount;
        bonkDetailsTable.querySelector(".barrageCount").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].barrageCount = parseInt(bonkDetailsTable.querySelector(".barrageCount").value);
            setData("customBonks", customBonks);
        });

        // Barrage Frequency
        bonkDetailsTable.querySelector(".barrageFrequencyOverride").checked = customBonks[customBonkName].barrageFrequencyOverride;
        bonkDetailsTable.querySelector(".barrageFrequency").disabled = !customBonks[customBonkName].barrageFrequencyOverride;
        bonkDetailsTable.querySelector(".barrageFrequencyOverride").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].barrageFrequencyOverride = bonkDetailsTable.querySelector(".barrageFrequencyOverride").checked;
            bonkDetailsTable.querySelector(".barrageFrequency").disabled = !customBonks[customBonkName].barrageFrequencyOverride;
            setData("customBonks", customBonks);
        });

        bonkDetailsTable.querySelector(".barrageFrequency").value = customBonks[customBonkName].barrageFrequency;
        bonkDetailsTable.querySelector(".barrageFrequency").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].barrageFrequency = parseFloat(bonkDetailsTable.querySelector(".barrageFrequency").value);
            setData("customBonks", customBonks);
        });

        // Throw Duration
        bonkDetailsTable.querySelector(".throwDurationOverride").checked = customBonks[customBonkName].throwDurationOverride;
        bonkDetailsTable.querySelector(".throwDuration").disabled = !customBonks[customBonkName].throwDurationOverride;
        bonkDetailsTable.querySelector(".throwDurationOverride").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].throwDurationOverride = bonkDetailsTable.querySelector(".throwDurationOverride").checked;
            bonkDetailsTable.querySelector(".throwDuration").disabled = !customBonks[customBonkName].throwDurationOverride;
            setData("customBonks", customBonks);
        });

        bonkDetailsTable.querySelector(".throwDuration").value = customBonks[customBonkName].throwDuration;
        bonkDetailsTable.querySelector(".throwDuration").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].throwDuration = parseFloat(bonkDetailsTable.querySelector(".throwDuration").value);
            setData("customBonks", customBonks);
        });

        // Spin Speed
        bonkDetailsTable.querySelector(".spinSpeedOverride").checked = customBonks[customBonkName].spinSpeedOverride;
        bonkDetailsTable.querySelector(".spinSpeedMin").disabled = !customBonks[customBonkName].spinSpeedOverride;
        bonkDetailsTable.querySelector(".spinSpeedMax").disabled = !customBonks[customBonkName].spinSpeedOverride;
        bonkDetailsTable.querySelector(".spinSpeedOverride").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].spinSpeedOverride = bonkDetailsTable.querySelector(".spinSpeedOverride").checked;
            bonkDetailsTable.querySelector(".spinSpeedMin").disabled = !customBonks[customBonkName].spinSpeedOverride;
            bonkDetailsTable.querySelector(".spinSpeedMax").disabled = !customBonks[customBonkName].spinSpeedOverride;
            setData("customBonks", customBonks);
        });

        bonkDetailsTable.querySelector(".spinSpeedMin").value = customBonks[customBonkName].spinSpeedMin;
        bonkDetailsTable.querySelector(".spinSpeedMin").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].spinSpeedMin = parseFloat(bonkDetailsTable.querySelector(".spinSpeedMin").value);
            setData("customBonks", customBonks);
        });

        // Throw Angle Max
        bonkDetailsTable.querySelector(".spinSpeedMax").value = customBonks[customBonkName].spinSpeedMax;
        bonkDetailsTable.querySelector(".spinSpeedMax").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].spinSpeedMax = parseFloat(bonkDetailsTable.querySelector(".spinSpeedMax").value);
            setData("customBonks", customBonks);
        });

        // Throw Angle
        bonkDetailsTable.querySelector(".throwAngleOverride").checked = customBonks[customBonkName].throwAngleOverride;
        bonkDetailsTable.querySelector(".throwAngleMin").disabled = !customBonks[customBonkName].throwAngleOverride;
        bonkDetailsTable.querySelector(".throwAngleMax").disabled = !customBonks[customBonkName].throwAngleOverride;
        bonkDetailsTable.querySelector(".throwAngleOverride").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].throwAngleOverride = bonkDetailsTable.querySelector(".throwAngleOverride").checked;
            bonkDetailsTable.querySelector(".throwAngleMin").disabled = !customBonks[customBonkName].throwAngleOverride;
            bonkDetailsTable.querySelector(".throwAngleMax").disabled = !customBonks[customBonkName].throwAngleOverride;
            setData("customBonks", customBonks);
        });

        bonkDetailsTable.querySelector(".throwAngleMin").value = customBonks[customBonkName].throwAngleMin;
        bonkDetailsTable.querySelector(".throwAngleMin").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].throwAngleMin = parseInt(bonkDetailsTable.querySelector(".throwAngleMin").value);
            setData("customBonks", customBonks);
        });

        bonkDetailsTable.querySelector(".throwAngleMax").value = customBonks[customBonkName].throwAngleMax;
        bonkDetailsTable.querySelector(".throwAngleMax").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].throwAngleMax = parseInt(bonkDetailsTable.querySelector(".throwAngleMax").value);
            setData("customBonks", customBonks);
        });

        // Throw Direction
        bonkDetailsTable.querySelector(".throwDirectionOverride").checked = customBonks[customBonkName].throwDirectionOverride;
        bonkDetailsTable.querySelector(".throwDirection").disabled = !customBonks[customBonkName].throwDirectionOverride;
        bonkDetailsTable.querySelector(".throwDirectionOverride").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].throwDirectionOverride = bonkDetailsTable.querySelector(".throwDirectionOverride").checked;
            bonkDetailsTable.querySelector(".throwDirection").disabled = !customBonks[customBonkName].throwDirectionOverride;
            setData("customBonks", customBonks);
        });

        bonkDetailsTable.querySelector(".throwDirection").value = customBonks[customBonkName].throwDirection;
        bonkDetailsTable.querySelector(".throwDirection").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].throwDirection = bonkDetailsTable.querySelector(".throwDirection").value;
            setData("customBonks", customBonks);
        });

        // Items
        bonkDetailsTable.querySelector(".imagesOverride").checked = customBonks[customBonkName].itemsOverride;
        bonkDetailsTable.querySelector(".images").disabled = !customBonks[customBonkName].itemsOverride;
        bonkDetailsTable.querySelector(".imagesOverride").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].itemsOverride = bonkDetailsTable.querySelector(".imagesOverride").checked;
            bonkDetailsTable.querySelector(".images").disabled = !customBonks[customBonkName].itemsOverride;
            setData("customBonks", customBonks);
        });

        bonkDetailsTable.querySelector(".images").addEventListener("click", () => {
            if (!bonkDetailsTable.querySelector(".images").disabled)
            {
                openImagesCustom(customBonkName);
                showPanel("bonkImagesCustom", true);
            }
        });

        // Sounds
        bonkDetailsTable.querySelector(".soundsOverride").checked = customBonks[customBonkName].soundsOverride;
        bonkDetailsTable.querySelector(".sounds").disabled = !customBonks[customBonkName].soundsOverride;
        bonkDetailsTable.querySelector(".soundsOverride").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].soundsOverride = bonkDetailsTable.querySelector(".soundsOverride").checked;
            bonkDetailsTable.querySelector(".sounds").disabled = !customBonks[customBonkName].soundsOverride;
            setData("customBonks", customBonks);
        });

        bonkDetailsTable.querySelector(".sounds").addEventListener("click", () => {
            if (!bonkDetailsTable.querySelector(".sounds").disabled)
            {
                openSoundsCustom(customBonkName);
                showPanel("bonkSoundsCustom", true);
            }
        });

        // Impact Decals
        bonkDetailsTable.querySelector(".impactDecals").addEventListener("click", () => {
            openImpactDecals(customBonkName);
            showPanel("impactDecals", true);
        });

        // Windup Sounds
        bonkDetailsTable.querySelector(".windupSounds").addEventListener("click", () => {
            openWindupSounds(customBonkName);
            showPanel("windupSounds", true);
        });

        // Windup Delay
        bonkDetailsTable.querySelector(".windupDelay").value = customBonks[customBonkName].windupDelay;
        bonkDetailsTable.querySelector(".windupDelay").addEventListener("change", async () => {
            customBonks = await getData("customBonks");
            customBonks[customBonkName].windupDelay = parseFloat(bonkDetailsTable.querySelector(".windupDelay").value);
            setData("customBonks", customBonks);
        });
    }
}

async function openBonks()
{
    var customBonks = await getData("customBonks");

    document.querySelectorAll(".customBonkRow").forEach(element => { element.remove(); });

    if (customBonks == null)
        setData("customBonks", {});
    else
    {
        for (const key in customBonks)
        {
            const row = document.querySelector("#customBonkRow").cloneNode(true);
            row.removeAttribute("id");
            row.removeAttribute("hidden");
            row.classList.add("customBonkRow");
            document.querySelector("#bonksTable").appendChild(row);

            row.querySelector(".bonkDetailsButton").addEventListener("click", () => {
                bonkDetails(key);
            });

            row.querySelector(".imageLabel").innerText = key;

            row.querySelector(".imageRemove").addEventListener("click", async () => {
                delete customBonks[key];
                setData("customBonks", customBonks);

                var throws = await getData("throws");
                for (var i = 0; i < throws.length; i++)
                {
                    if (throws[i].customs.includes(key))
                        throws[i].customs.splice(throws[i].customs.indexOf(key), 1);
                }
                setData("throws", throws);

                var impacts = await getData("impacts");
                for (var i = 0; i < impacts.length; i++)
                {
                    if (impacts[i].customs.includes(key))
                        impacts[i].customs.splice(impacts[i].customs.indexOf(key), 1);
                }

                setData("impacts", impacts);

                var eventType = await getData("redeems");
                for (var i = 0; i < eventType.length; i++)
                {
                    if (eventType[i].bonkType == key)
                        eventType[i].bonkType = "single";
                }
                setData("redeems", eventType);

                eventType = await getData("commands");
                for (var i = 0; i < eventType.length; i++)
                {
                    if (eventType[i].bonkType == key)
                        eventType[i].bonkType = "single";
                }
                setData("commands", eventType);

                eventType = await getData("subType");
                if (eventType == key)
                    setData("subType", "barrage");

                eventType = await getData("subGiftType");
                if (eventType == key)
                    setData("subGiftType", "barrage");

                openBonks();
            });
        };
    }
}

async function openTestBonks()
{
    var customBonks = await getData("customBonks");

    document.querySelectorAll(".testCustom").forEach(element => { element.remove(); });

    if (customBonks == null)
        setData("customBonks", {});
    else
    {
        for (const key in customBonks)
        {
            const row = document.querySelector("#testCustom").cloneNode(true);
            row.removeAttribute("id");
            row.removeAttribute("hidden");
            row.classList.add("testCustom");
            document.querySelector("#testCustom").after(row);

            row.querySelector(".innerTopButton").innerText = key;

            row.addEventListener("click", () => testCustomBonk(key));
        };
    }
}

document.querySelector("#redeemAdd").addEventListener("click", newRedeem);

// Create a new redeem event
async function newRedeem()
{
    var redeems = await getData("redeems");

    redeems.push({
        "enabled": true,
        "id": null,
        "name": null,
        "bonkType": "single"
    });

    setData("redeems", redeems);

    openEvents();
}

document.querySelector("#commandAdd").addEventListener("click", newCommand);

// Create a new command event
async function newCommand()
{
    var commands = await getData("commands");

    commands.push({
        "enabled": true,
        "modOnly": false,
        "name": "",
        "cooldown": 0,
        "bonkType": "single"
    });

    setData("commands", commands);

    openEvents();
}

var gettingRedeemData = false, redeemData, cancelledGetRedeemData = false;
async function getRedeemData()
{
    gettingRedeemData = true;
    cancelledGetRedeemData = false;
    ipcRenderer.send("listenRedeemStart");

    while (gettingRedeemData)
        await new Promise(resolve => setTimeout(resolve, 10));

    return redeemData;
}

ipcRenderer.on("redeemData", (event, message) => {
    redeemData = message;
    gettingRedeemData = false;
});

async function openEvents()
{
    const customBonks = await getData("customBonks");

    // Fill redeem rows
    var redeems = await getData("redeems");

    document.querySelectorAll(".redeemsRow").forEach(element => { element.remove(); });

    redeems.forEach((_, index) =>
    {
        var row = document.querySelector("#redeemsRow").cloneNode(true);
        row.removeAttribute("id");
        row.classList.add("redeemsRow");
        row.classList.remove("hidden");
        document.querySelector("#redeemsRow").after(row);

        row.querySelector(".redeemEnabled").checked = redeems[index].enabled;
        row.querySelector(".redeemEnabled").addEventListener("change", () => {
            redeems[index].enabled = row.querySelector(".redeemEnabled").checked;
            setData("redeems", redeems);
        });

        row.querySelector(".redeemName").innerHTML = redeems[index].name == null ? "<b class=\"errorText\">Unassigned</b>" : redeems[index].name;
        
        row.querySelector(".redeemID").addEventListener("click", async () => {
            row.querySelector(".redeemID").classList.add("hidden");
            row.querySelector(".redeemCancel").classList.remove("hidden");
            row.querySelector(".redeemName").innerText = "Listening...";
            var data = await getRedeemData();
            if (!cancelledGetRedeemData)
            {
                row.querySelector(".redeemID").classList.remove("hidden");
                row.querySelector(".redeemCancel").classList.add("hidden");
                redeems[index].id = data[0];
                redeems[index].name = data[1];
                row.querySelector(".redeemName").innerText = data[1];
                setData("redeems", redeems);
            }
        });
        
        row.querySelector(".redeemCancel").addEventListener("click", async () => {
            row.querySelector(".redeemID").classList.remove("hidden");
            row.querySelector(".redeemCancel").classList.add("hidden");
            
            row.querySelector(".redeemName").innerHTML = redeems[index].name == null ? "<b class=\"errorText\">Unassigned</b>" : redeems[index].name;

            cancelledGetRedeemData = true;
            gettingRedeemData = false;
            ipcRenderer.send("listenRedeemCancel");
        });

        for (var key in customBonks)
        {
            var customBonk = document.createElement("option");
            customBonk.value = key;
            customBonk.innerText = key;
            row.querySelector(".bonkType").appendChild(customBonk);
        }

        row.querySelector(".bonkType").value = redeems[index].bonkType;
        row.querySelector(".bonkType").addEventListener("change", () => {
            redeems[index].bonkType = row.querySelector(".bonkType").value;
            setData("redeems", redeems);
        });

        row.querySelector(".redeemRemove").addEventListener("click", () => {
            redeems.splice(index, 1);
            setData("redeems", redeems);
            openEvents();
        });
    });

    // Fill command rows
    var commands = await getData("commands");

    document.querySelectorAll(".commandsRow").forEach(element => { element.remove(); });
    
    commands.forEach((_, index) =>
    {
        var row = document.querySelector("#commandsRow").cloneNode(true);
        row.removeAttribute("id");
        row.classList.add("commandsRow");
        row.classList.remove("hidden");
        document.querySelector("#commandsRow").after(row);

        row.querySelector(".commandEnabled").checked = commands[index].enabled;
        row.querySelector(".commandEnabled").addEventListener("change", () => {
            commands[index].enabled = row.querySelector(".commandEnabled").checked;
            setData("commands", commands);
        });

        row.querySelector(".commandModOnly").checked = commands[index].modOnly;
        row.querySelector(".commandModOnly").addEventListener("change", () => {
            commands[index].modOnly = row.querySelector(".commandModOnly").checked;
            setData("commands", commands);
        });

        row.querySelector(".commandName").value = commands[index].name;
        row.querySelector(".commandName").addEventListener("change", () => {
            commands[index].name = row.querySelector(".commandName").value;
            setData("commands", commands);
        });

        row.querySelector(".commandCooldown").value = commands[index].cooldown;
        row.querySelector(".commandCooldown").addEventListener("change", () => {
            commands[index].cooldown = row.querySelector(".commandCooldown").value;
            setData("commands", commands);
        });

        for (var key in customBonks)
        {
            var customBonk = document.createElement("option");
            customBonk.value = key;
            customBonk.innerText = key;
            row.querySelector(".bonkType").appendChild(customBonk);
        }

        row.querySelector(".bonkType").value = commands[index].bonkType;
        row.querySelector(".bonkType").addEventListener("change", () => {
            commands[index].bonkType = row.querySelector(".bonkType").value;
            setData("commands", commands);
        });

        row.querySelector(".commandRemove").addEventListener("click", () => {
            commands.splice(index, 1);
            setData("commands", commands);
            openEvents();
        });
    });

    var node = document.querySelector("#followType");
    while (node.childElementCount > 4)
        node.removeChild(node.lastChild);

    for (var key in customBonks)
    {
        var customBonk = document.createElement("option");
        customBonk.value = key;
        customBonk.innerText = key;
        node.appendChild(customBonk);
    }

    // Update Sub and Gift Sub drop-downs
    node = document.querySelector("#subType");
    while (node.childElementCount > 4)
        node.removeChild(node.lastChild);

    for (var key in customBonks)
    {
        var customBonk = document.createElement("option");
        customBonk.value = key;
        customBonk.innerText = key;
        node.appendChild(customBonk);
    }

    node = document.querySelector("#subGiftType");
    while (node.childElementCount > 4)
        node.removeChild(node.lastChild);

    for (var key in customBonks)
    {
        var customBonk = document.createElement("option");
        customBonk.value = key;
        customBonk.innerText = key;
        node.appendChild(customBonk);
    }
}

// ----
// Data
// ----

const defaultData = JSON.parse(fs.readFileSync(__dirname + "/defaultData.json", "utf8"));

// Counter for number of writes that are being attempted
// Will only attempt to load data if not currently writing
// Inter-process communication means this is necessary
var isWriting = 0;
ipcRenderer.on("doneWriting", () => {
    if (--isWriting < 0)
        isWriting = 0;
});

// Get requested data, waiting for any current writes to finish first
async function getData(field)
{
    while (isWriting > 0)
        await new Promise(resolve => setTimeout(resolve, 10));

    if (!fs.existsSync(userDataPath + "/data.json"))
        fs.writeFileSync(userDataPath + "/data.json", JSON.stringify(defaultData));

    var data;
    // An error should only be thrown if the other process is in the middle of writing to the file.
    // If so, it should finish shortly and this loop will exit.
    while (data == null)
    {
        try {
            data = JSON.parse(fs.readFileSync(userDataPath + "/data.json", "utf8"));
        } catch {}
    }
    data = JSON.parse(fs.readFileSync(userDataPath + "/data.json", "utf8"));
    var field = data[field];
    if (typeof field === "string" || field instanceof String)
        return field.trim();
    return field;
}

// Send new data to the main process to write to file
function setData(field, value)
{
    isWriting++;
    ipcRenderer.send("setData", [ field, value ]);
    
    if (field == "portThrower" || field == "portVTubeStudio" || field == "ipThrower" || field == "ipVTubeStudio")
        setPorts();
}

// If ports change, write them to the file read by the Browser Source file
async function setPorts()
{
    fs.writeFileSync(__dirname + "/ports.js", "const ports = [ " + await getData("portThrower") + ", " + await getData("portVTubeStudio") + " ]; const ips = [ \"" + await getData("ipThrower") + "\", \"" + await getData("ipVTubeStudio") + "\" ];");
}

// Load the requested data and apply it to the relevant settings field
async function loadData(field)
{
    // Enable physics simulation for all users upon updating to 1.19
    if (field == "physicsSim")
    {
        var didPhysicsUpdate = await getData("didPhysicsUpdate");
        if (didPhysicsUpdate == null)
        {
            setData("physicsSim", true);
            setData("didPhysicsUpdate", true);
        }
    }

    const thisData = await getData(field);
    if (thisData != null)
    {
        if (document.querySelector("#" + field).type == "checkbox")
            document.querySelector("#" + field).checked = thisData;
        else
        {
            document.querySelector("#" + field).value = thisData;
            if (field == "portThrower" || field == "portVTubeStudio" || field == "ipThrower" || field == "ipVTubeStudio")
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

const folders = [ "throws", "impacts", "decals", "windups" ];
function copyFilesToDirectory()
{
    folders.forEach((folder) => {
        if (!fs.existsSync(__dirname + "/" + folder))
            fs.mkdirSync(__dirname + "/" + folder);

        fs.readdirSync(userDataPath + "/" + folder).forEach(file => {
            fs.copyFileSync(userDataPath + "/" + folder + "/" + file, __dirname + "/" + folder + "/" + file);
        });
    })
}

// Place all settings from data into the proper location on load
window.onload = async function()
{
    // UPDATE 1.19 (or new installation)
    if (!fs.existsSync(userDataPath))
        fs.mkdirSync(userDataPath);

    if (!fs.existsSync(userDataPath + "/data.json") && fs.existsSync(__dirname + "/data.json"))
        fs.copyFileSync(__dirname + "/data.json", userDataPath + "/data.json");
    
    folders.forEach((folder) => {
        if (!fs.existsSync(userDataPath + "/" + folder))
            fs.mkdirSync(userDataPath + "/" + folder);

        // Fix: fixed a dictionary not found crash.
        // When directly launch kbonk after packaging without folders "decals" or "windups" would cause this crash.
        // by adding this condition would fix (or just simply add those two folders)
        if (!fs.existsSync(__dirname + "/" + folder))
        fs.mkdirSync(__dirname + "/" + folder);

        fs.readdirSync(__dirname + "/" + folder).forEach(file => {
            if (!fs.existsSync(userDataPath + "/" + folder + "/" + file))
                fs.copyFileSync(__dirname + "/" + folder + "/" + file, userDataPath + "/" + folder + "/" + file);
        });
    })

    // UPDATING FROM 1.0.1 OR EARLIER
    var throws = await getData("throws");
    for (var i = 0; i < throws.length; i++)
    {
        if (Array.isArray(throws[i]))
        {
            throws[i] = {
                "location": throws[i][0],
                "weight": throws[i][1],
                "scale": throws[i][2],
                "sound": throws[i][3],
                "volume": throws[i][4] == null ? 1 : throws[i][4],
                "enabled": true,
                "customs": []
            };
        }
    }
    setData("throws", throws);

    var impacts = await getData("impacts");
    var bitImpacts = await getData("bitImpacts");
    var hasBitImpacts = bitImpacts != null && bitImpacts.length > 0;
    for (var i = 0; i < impacts.length; i++)
    {
        if (Array.isArray(impacts[i]))
        {
            impacts[i] = {
                "location": impacts[i][0],
                "volume": impacts[i][1],
                "enabled": true,
                "bits": !hasBitImpacts,
                "customs": []
            };
        }
    }
    setData("impacts", impacts);

    if (bitImpacts != null)
    {
        var impacts = await getData("impacts");
        for (var i = 0; i < bitImpacts.length; i++)
        {
            impacts.push({
                "location": bitImpacts[i][0],
                "volume": bitImpacts[i][1],
                "enabled": false,
                "bits": true,
                "customs": []
            });
        }

        setData("bitImpacts", null);
        setData("impacts", impacts);
    }

    var redeems = await getData("redeems");
    if (redeems == null)
    {
        redeems = [];

        var oldId = await getData("singleRedeemID");
        var oldEnabled = await getData("singleRedeemEnabled");
        if (oldId != null && oldId != "")
        {
            redeems.push({
                "enabled": oldEnabled == null || !oldEnabled ? false : true,
                "id": oldId,
                "name": "Single",
                "bonkType": "single"
            });
        }

        oldId = await getData("barrageRedeemID");
        oldEnabled = await getData("barrageRedeemEnabled");
        if (oldId != null && oldId != "")
        {
            redeems.push({
                "enabled": oldEnabled == null || !oldEnabled ? false : true,
                "id": oldId,
                "name": "Barrage",
                "bonkType": "barrage"
            });
        }

        setData("redeems", redeems);
    }

    var commands = await getData("commands");
    if (commands == null)
    {
        commands = [];

        var oldCommand = await getData("singleCommandTitle");
        var oldEnabled = await getData("singleCommandEnabled");
        if (oldCommand != null && oldCommand != "")
        {
            commands.push({
                "enabled": oldEnabled == null || !oldEnabled ? false : true,
                "name": oldCommand,
                "cooldown": await getData("singleCommandCooldown"),
                "bonkType": "single"
            });
        }

        oldCommand = await getData("barrageCommandTitle");
        oldEnabled = await getData("barrageCommandEnabled");
        if (oldCommand != null && oldCommand != "")
        {
            commands.push({
                "enabled": oldEnabled == null || !oldEnabled ? false : true,
                "name": oldCommand,
                "cooldown": await getData("singleCommandCooldown"),
                "bonkType": "barrage"
            });
        }

        setData("commands", commands);
    }

    // UPDATE 1.12
    // Added Spin Speed settings
    var customBonks = await getData("customBonks");
    if (customBonks != null)
    {
        for (const key in customBonks)
        {
            if (customBonks[key].spinSpeedOverride == null)
                customBonks[key].spinSpeedOverride = false;
            if (customBonks[key].spinSpeedMin == null)
                customBonks[key].spinSpeedMin = 5;
            if (customBonks[key].spinSpeedMax == null)
                customBonks[key].spinSpeedMax = 10;
        }

        setData("customBonks", customBonks);
    }

    // UPDATE 1.13
    // Added "Minimize to Tray" option
    var tray = await getData("minimizeToTray");
    if (tray == null)
        setData("minimizeToTray", false);

    // UPDATE 1.22
    // Changed "Return Speed" to "Return Time"
    var prevVer = await getData("version");
    if (prevVer != null && prevVer < 1.22)
        setData("returnSpeed", 0.3);
    
    var commands = await getData("commands");
    if (commands != null)
    {
        for (const key in commands)
        {
            if (commands[key].modOnly == null)
            commands[key].modOnly = false;
        }

        setData("commands", commands);
    }

    // UPDATE 1.23
    // Added "Throw Direction" setting
    // Added Custom IP setting for Browser Source
    // Added Custom IP setting for VTube Studio
    var prevVer = await getData("version");
    if (prevVer == null || prevVer < 1.22)
        setData("throwDirection", "weighted");
    
    if (customBonks != null)
    {
        for (const key in customBonks)
        {
            if (customBonks[key].throwDirectionOverride == null)
                customBonks[key].throwDirectionOverride = false;
            if (customBonks[key].throwDirection == null)
                customBonks[key].throwDirection = "weighted";
        }

        setData("customBonks", customBonks);
    }

    var ipThrower = await getData("ipThrower");
    if (ipThrower == null)
        setData("ipThrower", "");

    var ipVTubeStudio = await getData("ipVTubeStudio");
    if (ipVTubeStudio == null)
        setData("ipVTubeStudio", "");

    // END UPDATING

    loadData("followEnabled");
    loadData("subEnabled");
    loadData("subGiftEnabled");
    loadData("bitsEnabled");
    loadData("raidEnabled");

    loadData("followType");
    loadData("subType");
    loadData("subGiftType");
    loadData("bitsMinDonation");
    loadData("bitsMaxBarrageCount");
    loadData("raidMinRaiders");
    loadData("raidMinBarrageCount");
    loadData("raidMaxBarrageCount");

    loadData("followCooldown");
    loadData("subCooldown");
    loadData("subGiftCooldown");
    loadData("bitsCooldown");
    loadData("raidCooldown");
    loadData("bitsOnlySingle");
    loadData("raidEmotes");

    loadData("barrageCount");
    loadData("barrageFrequency");
    loadData("throwDuration");
    loadData("returnSpeed");
    loadData("throwAngleMin");
    loadData("throwAngleMax");
    loadData("throwDirection");
    loadData("physicsSim");
    loadData("physicsFPS");
    loadData("physicsGravity");
    loadData("physicsReverse");
    loadData("physicsRotate");
    loadData("physicsHorizontal");
    loadData("physicsVertical");
    loadData("spinSpeedMin");
    loadData("spinSpeedMax");
    loadData("closeEyes");
    loadData("openEyes");
    loadData("itemScaleMin");
    loadData("itemScaleMax");
    loadData("delay");
    loadData("volume");
    loadData("portThrower");
    loadData("portVTubeStudio");
    loadData("ipThrower");
    loadData("ipVTubeStudio");
    loadData("minimizeToTray");
    
    openImages();
    openBitImages();
    copyFilesToDirectory();

    checkVersion();
    document.title += " " + version;
    setData("version", version);
}

// Event listeners for changing settings
document.querySelector("#followEnabled").addEventListener("change", () => setData("followEnabled", document.querySelector("#followEnabled").checked));
document.querySelector("#subEnabled").addEventListener("change", () => setData("subEnabled", document.querySelector("#subEnabled").checked));
document.querySelector("#subGiftEnabled").addEventListener("change", () => setData("subGiftEnabled", document.querySelector("#subGiftEnabled").checked));
document.querySelector("#bitsEnabled").addEventListener("change", () => setData("bitsEnabled", document.querySelector("#bitsEnabled").checked));
document.querySelector("#raidEnabled").addEventListener("change", () => setData("raidEnabled", document.querySelector("#raidEnabled").checked));

document.querySelector("#followType").addEventListener("change", () => setData("followType", document.querySelector("#followType").value));
document.querySelector("#subType").addEventListener("change", () => setData("subType", document.querySelector("#subType").value));
document.querySelector("#subGiftType").addEventListener("change", () => setData("subGiftType", document.querySelector("#subGiftType").value));
document.querySelector("#bitsMinDonation").addEventListener("change", () => { clampValue(document.querySelector("#bitsMinDonation"), 0, null); setData("bitsMinDonation", parseInt(document.querySelector("#bitsMinDonation").value)) });
document.querySelector("#bitsMaxBarrageCount").addEventListener("change", () => { clampValue(document.querySelector("#bitsMaxBarrageCount"), 0, null); setData("bitsMaxBarrageCount", parseInt(document.querySelector("#bitsMaxBarrageCount").value)) });

document.querySelector("#raidMinRaiders").addEventListener("change", () => { setData("raidMinRaiders", parseInt(document.querySelector("#raidMinRaiders").value)) });
document.querySelector("#raidMinBarrageCount").addEventListener("change", () => { clampValue(document.querySelector("#raidMinBarrageCount"), 0, parseFloat(document.querySelector("#raidMaxBarrageCount").value)); setData("raidMinBarrageCount", parseInt(document.querySelector("#raidMinBarrageCount").value)) });
document.querySelector("#raidMaxBarrageCount").addEventListener("change", () => { clampValue(document.querySelector("#raidMaxBarrageCount"), parseFloat(document.querySelector("#raidMinBarrageCount").value), null); setData("raidMaxBarrageCount", parseInt(document.querySelector("#raidMaxBarrageCount").value)) });

document.querySelector("#followCooldown").addEventListener("change", () => { clampValue(document.querySelector("#followCooldown"), 0, null); setData("followCooldown", parseFloat(document.querySelector("#followCooldown").value)) });
document.querySelector("#subCooldown").addEventListener("change", () => { clampValue(document.querySelector("#subCooldown"), 0, null); setData("subCooldown", parseFloat(document.querySelector("#subCooldown").value)) });
document.querySelector("#subGiftCooldown").addEventListener("change", () => { clampValue(document.querySelector("#subGiftCooldown"), 0, null); setData("subGiftCooldown", parseFloat(document.querySelector("#subGiftCooldown").value)) });
document.querySelector("#bitsCooldown").addEventListener("change", () => { clampValue(document.querySelector("#bitsCooldown"), 0, null); setData("bitsCooldown", parseFloat(document.querySelector("#bitsCooldown").value)) });
document.querySelector("#raidCooldown").addEventListener("change", () => { clampValue(document.querySelector("#raidCooldown"), 0, null); setData("raidCooldown", parseFloat(document.querySelector("#raidCooldown").value)) });
document.querySelector("#raidEnabled").addEventListener("change", () => setData("raidEnabled", document.querySelector("#raidEnabled").checked));

document.querySelector("#bitsOnlySingle").addEventListener("change", () => setData("bitsOnlySingle", document.querySelector("#bitsOnlySingle").checked));
document.querySelector("#raidEmotes").addEventListener("change", () => setData("raidEmotes", document.querySelector("#raidEmotes").checked));

document.querySelector("#barrageCount").addEventListener("change", () => { clampValue(document.querySelector("#barrageCount"), 0, null); setData("barrageCount", parseInt(document.querySelector("#barrageCount").value)) });
document.querySelector("#barrageFrequency").addEventListener("change", () => { clampValue(document.querySelector("#barrageFrequency"), 0, null); setData("barrageFrequency", parseFloat(document.querySelector("#barrageFrequency").value)) });
document.querySelector("#throwDuration").addEventListener("change", () => { clampValue(document.querySelector("#throwDuration"), 0.1, null); setData("throwDuration", parseFloat(document.querySelector("#throwDuration").value)) });
document.querySelector("#returnSpeed").addEventListener("change", () => { clampValue(document.querySelector("#returnSpeed"), 0, null); setData("returnSpeed", parseFloat(document.querySelector("#returnSpeed").value)) });
document.querySelector("#throwAngleMin").addEventListener("change", () => { clampValue(document.querySelector("#throwAngleMin"), -90, parseFloat(document.querySelector("#throwAngleMax").value)); setData("throwAngleMin", parseFloat(document.querySelector("#throwAngleMin").value)) });
document.querySelector("#throwAngleMax").addEventListener("change", () => { clampValue(document.querySelector("#throwAngleMax"), parseFloat(document.querySelector("#throwAngleMin").value), null); setData("throwAngleMax", parseFloat(document.querySelector("#throwAngleMax").value)) });
document.querySelector("#throwDirection").addEventListener("change", () => { setData("throwDirection", document.querySelector("#throwDirection").value) });
document.querySelector("#spinSpeedMin").addEventListener("change", () => { clampValue(document.querySelector("#spinSpeedMin"), 0, parseFloat(document.querySelector("#spinSpeedMax").value)); setData("spinSpeedMin", parseFloat(document.querySelector("#spinSpeedMin").value)) });
document.querySelector("#spinSpeedMax").addEventListener("change", () => { clampValue(document.querySelector("#spinSpeedMax"), parseFloat(document.querySelector("#spinSpeedMin").value), null); setData("spinSpeedMax", parseFloat(document.querySelector("#spinSpeedMax").value)) });
document.querySelector("#physicsSim").addEventListener("change", () => setData("physicsSim", document.querySelector("#physicsSim").checked));
document.querySelector("#physicsFPS").addEventListener("change", () => { clampValue(document.querySelector("#physicsFPS"), 1, 60); setData("physicsFPS", parseFloat(document.querySelector("#physicsFPS").value)) });
document.querySelector("#physicsGravity").addEventListener("change", () => { clampValue(document.querySelector("#physicsGravity"), 0.01, null); setData("physicsGravity", parseFloat(document.querySelector("#physicsGravity").value)) });
document.querySelector("#physicsReverse").addEventListener("change", () => setData("physicsReverse", document.querySelector("#physicsReverse").checked));
document.querySelector("#physicsRotate").addEventListener("change", () => setData("physicsRotate", document.querySelector("#physicsRotate").checked));
document.querySelector("#physicsHorizontal").addEventListener("change", () => { setData("physicsHorizontal", parseFloat(document.querySelector("#physicsHorizontal").value)) });
document.querySelector("#physicsVertical").addEventListener("change", () => { setData("physicsVertical", parseFloat(document.querySelector("#physicsVertical").value)) });

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
document.querySelector("#portThrower").addEventListener("change", () => { differentValue(document.querySelector("#portThrower"), document.querySelector("#portVTubeStudio")); clampValue(document.querySelector("#portThrower"), 1024, 65535); setData("portThrower", parseInt(document.querySelector("#portThrower").value)) });
document.querySelector("#portVTubeStudio").addEventListener("change", () => { differentValue(document.querySelector("#portVTubeStudio"), document.querySelector("#portThrower")); clampValue(document.querySelector("#portVTubeStudio"), 1024, 65535); setData("portVTubeStudio", parseInt(document.querySelector("#portVTubeStudio").value)) });
document.querySelector("#ipThrower").addEventListener("change", () => setData("ipThrower", document.querySelector("#ipThrower").value));
document.querySelector("#ipVTubeStudio").addEventListener("change", () => setData("ipVTubeStudio", document.querySelector("#ipVTubeStudio").value));
document.querySelector("#minimizeToTray").addEventListener("change", () => setData("minimizeToTray", document.querySelector("#minimizeToTray").checked));

function differentValue(node, otherNode)
{
    if (node.value == otherNode.value)
        node.value++;
}

function clampValue(node, min, max)
{
    var val = node.value;
    if (min != null && val < min)
        val = min;
    if (max != null && val > max)
        val = max;
    node.value = val;
}

// -----------------
// Window Animations
// -----------------

var currentPanel = document.querySelector("#bonkImages"), playing = false;

// Window Event Listeners
document.querySelector("#header").addEventListener("click", () => { showPanelLarge("statusWindow"); });

document.querySelector("#helpButton").addEventListener("click", () => { ipcRenderer.send("help"); });
document.querySelector("#calibrateButton").addEventListener("click", () => { showPanelLarge("statusWindow", true); });
document.querySelector("#settingsButton").addEventListener("click", () => { showPanelLarge("settings"); });
document.querySelector("#testBonksButton").addEventListener("click", () => { showPanelLarge("testBonks"); });

document.querySelector("#imagesButton").addEventListener("click", () => { showPanel("bonkImages"); });
document.querySelector("#soundsButton").addEventListener("click", () => { showPanel("bonkSounds"); });
document.querySelector("#customButton").addEventListener("click", () => { showPanel("customBonks"); });
document.querySelector("#eventsButton").addEventListener("click", () => { showPanel("events"); });

document.querySelector("#imagesDefaultTab").addEventListener("click", () => { showTab("imageTable", [ "bitImageTable" ], "imagesDefaultTab", [ "imagesBitsTab" ]); });
document.querySelector("#imagesBitsTab").addEventListener("click", () => { showTab("bitImageTable", [ "imageTable" ], "imagesBitsTab", [ "imagesDefaultTab" ]); });

document.querySelector("#soundsDefaultTab").addEventListener("click", () => { showTab("soundTable", [ "bitSoundTable" ], "soundsDefaultTab", [ "soundsBitsTab" ]); });
document.querySelector("#soundsBitsTab").addEventListener("click", () => { showTab("bitSoundTable", [ "soundTable" ], "soundsBitsTab", [ "soundsDefaultTab" ]); });

document.querySelectorAll(".windowBack").forEach((element) => { element.addEventListener("click", () => { back(); }) });

function showTab(show, hide, select, deselect)
{
    if (show == "soundTable")
        openSounds();
    else if (show == "bitSoundTable")
        openBitSounds();

    for (var i = 0; i < hide.length; i++)
        document.querySelector("#" + hide[i]).classList.add("hidden");

    document.querySelector("#" + show).classList.remove("hidden");

    for (var i = 0; i < deselect.length; i++)
        document.querySelector("#" + deselect[i]).classList.remove("selectedTab");

    document.querySelector("#" + select).classList.add("selectedTab");
}

function removeAll(panel)
{
    panel.classList.remove("leftIn");
    panel.classList.remove("rightIn");
    panel.classList.remove("upIn");
    panel.classList.remove("downIn");

    panel.classList.remove("leftOut");
    panel.classList.remove("rightOut");
    panel.classList.remove("upOut");
    panel.classList.remove("downOut");
}

var panelStack = [];

function back()
{
    if (!playingLarge && openPanelLarge)
    {
        openPanelLarge = false;

        var anim = Math.floor(Math.random() * 4);
        switch (anim)
        {
            case 0:
                anim = "left";
                break;
            case 1:
                anim = "right";
                break;
            case 2:
                anim = "up";
                break;
            case 3:
                anim = "down";
                break;
        }

        removeAll(document.querySelector("#wideWindow"));
        document.querySelector("#wideWindow").classList.add(anim + "Out");

        if (currentPanelLarge.id == "statusWindow" && (status == 3 || status == 4 || status == 7))
        {
            cancelCalibrate = true;
            ipcRenderer.send("cancelCalibrate");
        }

        playingLarge = true;
        setTimeout(() => {
            currentPanelLarge.classList.add("hidden");
            currentPanelLarge = null;
            playingLarge = false;
            cancelCalibrate = false;
            document.querySelector("#wideWindow").classList.add("hidden");
        }, 500);
    }
    else if (panelStack.length > 0)
        showPanel(panelStack.pop(), false);
}

function showPanel(panel, stack)
{
    if (!playing)
    {
        if (document.querySelector("#" + panel) != currentPanel)
        {
            playing = true;

            var anim = Math.floor(Math.random() * 4);
            switch (anim)
            {
                case 0:
                    anim = "left";
                    break;
                case 1:
                    anim = "right";
                    break;
                case 2:
                    anim = "up";
                    break;
                case 3:
                    anim = "down";
                    break;
            }

            var oldPanel = currentPanel;
            removeAll(oldPanel);
            oldPanel.classList.add(anim + "Out");
            
            setTimeout(() => {
                oldPanel.classList.add("hidden");
            }, 500);

            if (stack == null)
                panelStack = [];

            if (stack == null || !stack)
            {

                document.querySelector("#sideBar").querySelectorAll(".overlayButton").forEach((element) => { element.classList.remove("buttonSelected"); });
    
                if (panel == "bonkImages")
                {
                    document.querySelector("#imagesButton").querySelector(".overlayButton").classList.add("buttonSelected");
                    openImages();
                }
                else if (panel == "bonkSounds")
                {
                    document.querySelector("#soundsButton").querySelector(".overlayButton").classList.add("buttonSelected");
                    openSounds();
                    openBitSounds();
                }
                else if (panel == "customBonks")
                {
                    document.querySelector("#customButton").querySelector(".overlayButton").classList.add("buttonSelected");
                    openBonks();
                }
                else if (panel == "events")
                {
                    document.querySelector("#eventsButton").querySelector(".overlayButton").classList.add("buttonSelected");
                    openEvents();
                }
            }
            else if (stack)
                panelStack.push(oldPanel.id);

            currentPanel = document.querySelector("#" + panel);
            currentPanel.classList.remove("hidden");
            removeAll(currentPanel);
            currentPanel.classList.add(anim + "In");

            setTimeout(() => {
                playing = false;
            }, 500);
        }
    }
}

var currentPanelLarge, playingLarge = false, openPanelLarge = false, cancelCalibrate = false;

function showPanelLarge(panel)
{
    if (!playingLarge)
    {
        if (document.querySelector("#" + panel) != currentPanelLarge)
        {
            var anim = Math.floor(Math.random() * 4);
            switch (anim)
            {
                case 0:
                    anim = "left";
                    break;
                case 1:
                    anim = "right";
                    break;
                case 2:
                    anim = "up";
                    break;
                case 3:
                    anim = "down";
                    break;
            }

            if (panel == "testBonks")
                openTestBonks();

            var oldPanel = currentPanelLarge;
            currentPanelLarge = document.querySelector("#" + panel);
            removeAll(currentPanelLarge);
            currentPanelLarge.classList.remove("hidden");

            if (!openPanelLarge)
            {
                openPanelLarge = true;
                removeAll(document.querySelector("#wideWindow"));
                document.querySelector("#wideWindow").classList.remove("hidden");
                document.querySelector("#wideWindow").classList.add(anim + "In");
            }
            else
            {
                if (oldPanel != null)
                {
                    if (oldPanel.id == "statusWindow" && (status == 3 || status == 4 || status == 7))
                        ipcRenderer.send("cancelCalibrate");

                    removeAll(oldPanel);
                    oldPanel.classList.add(anim + "Out");
                    setTimeout(() => {
                        oldPanel.classList.add("hidden");
                    }, 500);
                }
    
                currentPanelLarge.classList.add(anim + "In");
            }

            playingLarge = true;
            setTimeout(() => {
                playingLarge = false;
            }, 500);
        }
        else
            back();
    }
}

// In response to raid event from main process.
// Do the HTTP request here, since it"s already a browser of sorts, and send the response back.
ipcRenderer.on("raid", (event, message) => { getRaidEmotes(event, message); });
function getRaidEmotes(_, data)
{
  var channelEmotes = new XMLHttpRequest();
  channelEmotes.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200)
      {
          const emotes = JSON.parse(this.responseText);
          ipcRenderer.send("emotes", emotes);
      }
  };
  // Open the request and send it.
  channelEmotes.open("GET", "https://api.twitch.tv/helix/chat/emotes?broadcaster_id=" + data[0], true);
  channelEmotes.setRequestHeader("Authorization", "Bearer " + data[1]);
  channelEmotes.setRequestHeader("Client-Id", "u4rwa52hwkkgyoyow0t3gywxyv54pg");
  channelEmotes.send();
}

function checkVersion()
{
    var versionRequest = new XMLHttpRequest();
    versionRequest.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200)
        {
            const latestVersion = JSON.parse(this.responseText);
            if (latestVersion.latest > version)
                document.querySelector("#newVersion").classList.remove("hidden");
        }
    };
    // Open the request and send it.
    versionRequest.open("GET", "https://itch.io/api/1/x/wharf/latest?game_id=1387406&channel_name=win32", true);
    versionRequest.send();
}

// -----------------------
// Testing and Calibration
// -----------------------

document.querySelector("#testSingle").addEventListener("click", () => { ipcRenderer.send("single"); });
document.querySelector("#testBarrage").addEventListener("click", () => { ipcRenderer.send("barrage"); });
document.querySelector("#testSub").addEventListener("click", () => { ipcRenderer.send("sub"); });
document.querySelector("#testSubGift").addEventListener("click", () => { ipcRenderer.send("subGift"); });
document.querySelector("#testBits").addEventListener("click", () => { ipcRenderer.send("bits"); });
document.querySelector("#testFollow").addEventListener("click", () => { ipcRenderer.send("follow"); });
document.querySelector("#testEmote").addEventListener("click", () => { ipcRenderer.send("emote"); });
document.querySelector("#testRaid").addEventListener("click", () => { ipcRenderer.send("raid"); });

document.querySelector("#calibrateButton").addEventListener("click", () => { if (!cancelCalibrate) ipcRenderer.send("startCalibrate"); });
document.querySelector("#nextCalibrate").addEventListener("click", () => { ipcRenderer.send("nextCalibrate"); });
document.querySelector("#cancelCalibrate").addEventListener("click", () => { ipcRenderer.send("cancelCalibrate"); back(); });

// Test a specific item
async function testItem(index)
{
    const throws = await getData("throws");
    ipcRenderer.send("testItem", throws[index]);
}

function testCustomBonk(customName)
{
    ipcRenderer.send("testCustomBonk", customName);
}