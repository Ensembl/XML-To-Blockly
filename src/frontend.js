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

function XMLToBlocklyWorkspace(){
    this.blocklyWorkspace;
    this.blockStructureDict;
    this.validatorDict;
}

XMLToBlocklyWorkspace.prototype.loadOurExample = function( example_name ){
    var url = "examples/" + example_name;
    if ((navigator.userAgent.indexOf("Firefox") < 0) && (window.location.protocol == "file:")) {
        url = "https://raw.githubusercontent.com/Ensembl/XML-To-Blockly/gh-pages/" + url;
    }
    console.log(url);
    var fileContent = syncLoadFileFromURL(url);
    document.getElementById('file-name').innerHTML = example_name;
    document.getElementById('rng_area').value = fileContent;
    this.handleRNG( fileContent )
}

//init function for initializing the Blockly block area
XMLToBlocklyWorkspace.prototype.initWorkspace = function() {
    this.blocklyWorkspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        comments: false,
        trashcan: true,
         zoom: {controls: true, wheel: false},
         grid: {spacing: 20},
        collapse: true
    });
    this.blocklyWorkspace.addChangeListener(Blockly.Events.disableOrphans);
    this.blocklyWorkspace.addChangeListener(this.validateEvent());
}

// loads the file into RNG textarea and leaves it there for potential manual edit
function readFile(event) {
    var filename = event.target.files[0];
    var reader = new FileReader();
    reader.readAsText(filename);
    reader.onload = function(e){
        document.getElementById('file-name').innerHTML = filename.name;
        document.getElementById('rng_area').value = e.target.result;
    }
}

//handles xml by creating blocks as per RNG rules
XMLToBlocklyWorkspace.prototype.handleRNG = function(unparsedRNG) {

    var xmlParser = new DOMParser();
    var rngDoc = xmlParser.parseFromString(unparsedRNG, "text/xml");

    this.blockStructureDict = {};   //initialize these dictionaries here instead of in RNG2Blockly
    this.validatorDict = {};
    var rng2Blockly = new RNG2Blockly(rngDoc , this.blockStructureDict, this.validatorDict);

    document.getElementById('parsing-error-p').innerHTML    = rng2Blockly.errorBuffer.join("<br/>\n");
    document.getElementById('toolbox').innerHTML            = rng2Blockly.toolboxXML;
    document.getElementById('results').innerHTML            = "<pre>" + rng2Blockly.allCode.join("</pre><pre>") + "</pre>";

    eval(rng2Blockly.allCode.join(""));

    this.blocklyWorkspace.clear();
    this.blocklyWorkspace.updateToolbox( document.getElementById('toolbox') );
    document.getElementById('saveBtn').disabled = false;
}


XMLToBlocklyWorkspace.prototype.generateXML = function(){
    var xmlDoc = new XMLGenerator(this.blockStructureDict , this.blocklyWorkspace);
    if(xmlDoc.errorText) {
        document.getElementById('validation-error-p').innerHTML = xmlDoc.errorText;
        document.getElementById('XMLOutput').value = "";
    } else {
        var XMLToString = new XMLSerializer().serializeToString(xmlDoc.XMLDoc);
        var output = vkbeautify.xml(XMLToString);
        document.getElementById('validation-error-p').innerHTML = "";
        document.getElementById('XMLOutput').value = output;
    }
}
