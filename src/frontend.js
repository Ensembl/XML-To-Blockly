/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var blocklyWorkspace;

function loadOurExample( example_name ){
    var url = "examples/" + example_name;
    if ((navigator.userAgent.indexOf("Firefox") < 0) && (window.location.protocol == "file:")) {
        url = "https://raw.githubusercontent.com/Ensembl/XML-To-Blockly/gh-pages/" + url;
    }
    console.log(url);
    var fileContent = syncLoadFileFromURL(url);
    document.getElementById('file-name').innerHTML = example_name;
    document.getElementById('rng_area').value = fileContent;
    handleRNG( fileContent )
}

//init function for initializing the Blockly block area
function initWorkspace() {
    blocklyWorkspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        comments: false,
        trashcan: true,
         zoom: {controls: true, wheel: true},
         grid: {spacing: 20},
        collapse: true
    });
    blocklyWorkspace.addChangeListener(Blockly.Events.disableOrphans);
    blocklyWorkspace.addChangeListener(validateEvent);
}

// loads the file into RNG textarea and leaves it there for potential manual edit
function readFile(event) {
    var filename = event.target.files[0];
    var reader = new FileReader();
    reader.readAsText(filename);
    reader.onload = function(e){
        document.getElementById("file-name").innerHTML = filename.name;
        document.getElementById('rng_area').value = e.target.result;
    }
}

//handles xml by creating blocks as per RNG rules
function handleRNG(unparsedRNG) {

    var xmlParser = new DOMParser();
    var rngDoc = xmlParser.parseFromString(unparsedRNG, "text/xml");

    var rng2Blockly = new RNG2Blockly(rngDoc);

    document.getElementById('toolbox').innerHTML = rng2Blockly.toolboxXML;
    document.getElementById('results').innerHTML = "<pre>" + rng2Blockly.allCode.join("</pre><pre>") + "</pre>";

    eval(rng2Blockly.allCode.join(""));

    blocklyWorkspace.clear();
    blocklyWorkspace.updateToolbox( document.getElementById('toolbox') );
    document.getElementById('saveBtn').disabled = false;
}


function generateXML(){
    var xmlDoc = new XMLGenerator();
    var XMLToString = new XMLSerializer().serializeToString(xmlDoc.XMLDoc);
	var output = vkbeautify.xml(XMLToString);
	document.getElementById("XMLOutput").value = output;
}
