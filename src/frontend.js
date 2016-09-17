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
    this.rng2Blockly;
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
        document.getElementById("file-name").innerHTML = filename.name;
        document.getElementById('rng_area').value = e.target.result;
    }
}

//handles xml by creating blocks as per RNG rules
XMLToBlocklyWorkspace.prototype.handleRNG = function(unparsedRNG) {

    var xmlParser = new DOMParser();
    var rngDoc = xmlParser.parseFromString(unparsedRNG, "text/xml");

    this.blockStructureDict = {};   //initialize these dictionaries here instead of in RNG2Blockly
    this.validatorDict = {};
    this.rng2Blockly = new RNG2Blockly(rngDoc , this.blockStructureDict, this.validatorDict);

    document.getElementById('toolbox').innerHTML = this.rng2Blockly.toolboxXML;
    document.getElementById('results').innerHTML = "<pre>" + this.rng2Blockly.allCode.join("</pre><pre>") + "</pre>";

    eval(this.rng2Blockly.allCode.join(""));

    this.blocklyWorkspace.clear();
    this.blocklyWorkspace.updateToolbox( document.getElementById('toolbox') );
    document.getElementById('saveBtn').disabled = false;
}


XMLToBlocklyWorkspace.prototype.generateXML = function(){
    var xmlDoc = new XMLGenerator(this.blockStructureDict , this.blocklyWorkspace);
    var XMLToString = new XMLSerializer().serializeToString(xmlDoc.XMLDoc);
	var output = vkbeautify.xml(XMLToString);
	document.getElementById("XMLOutput").value = output;
}


XMLToBlocklyWorkspace.prototype.saveWork = function(){
    // Initialize Firebase
    var config = {
        apiKey: "AIzaSyAsV5_3mh22NgE44pOM1044-KRZf-qjTzg",
        //authDomain: "my-playground-15a8d.firebaseapp.com",
        databaseURL: "https://my-playground-15a8d.firebaseio.com",
        //storageBucket: "my-playground-15a8d.appspot.com",
        //messagingSenderId: "91241653928"
    };
    try{
        firebase.initializeApp(config);
    }
    catch(e){
        console.log("Firebase has already been initialized");
    }
    //firebase.database().ref().push("Hello there");
    var workspace = Blockly.Xml.workspaceToDom(this.blocklyWorkspace);
    workspace = Blockly.Xml.domToText(workspace);
    console.log(workspace);
    var dataToStore = {
        'projectName'     :   "Project" + Math.floor((Math.random() * 100) + 1),    //temporarily use random numbers to store project names

        'projectData'     :   {
            'workspace'     :   workspace,
            'toolbox'       :   this.rng2Blockly.toolboxXML,
            'blockXML'      :   this.rng2Blockly.allCode.join(""),
            'blockStructureDict':this.blockStructureDict,
            'validatorDict' :   this.validatorDict
        }
    };

    firebase.database().ref().push(dataToStore);
}
