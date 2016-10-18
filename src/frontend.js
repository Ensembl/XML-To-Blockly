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


function XMLToBlocklyWorkspace() {
    this.blockStructureDict;
    this.validatorDict;

    this.blocklyWorkspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        comments: false,
        trashcan: true,
         zoom: {controls: true, wheel: false},
         grid: {spacing: 20},
        collapse: true
    });
    this.blocklyWorkspace.addChangeListener(Blockly.Events.disableOrphans);
    this.blocklyWorkspace.addChangeListener( this.validateEvent.bind(this) );
}


// loads an example RNG file from our gitHub repository and automatically runs the parser
XMLToBlocklyWorkspace.prototype.loadOurExample = function( example_name ){
    var url = "examples/" + example_name;
    if ((navigator.userAgent.indexOf("Firefox") < 0) && (window.location.protocol == "file:")) {
        url = "https://raw.githubusercontent.com/Ensembl/XML-To-Blockly/gh-pages/" + url;
    }
    console.log(url);
    var fileContent = syncLoadFileFromURL(url);
    document.getElementById('file-name').innerHTML = example_name;
    document.getElementById('rng_area').value = fileContent;
    this.handleRNG( fileContent );
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
    document.getElementById('blockly_code_area').innerHTML  = "<pre>" + rng2Blockly.allCode.join("</pre><pre>") + "</pre>";

    eval(rng2Blockly.allCode.join(""));

    this.blocklyWorkspace.clear();
    this.blocklyWorkspace.updateToolbox( document.getElementById('toolbox') );
    document.getElementById('saveBtn').disabled = false;
}


XMLToBlocklyWorkspace.prototype.validateBlocklyGraph = function(){
    var blocks = this.blocklyWorkspace.getTopBlocks();

	document.getElementById("XMLOutput").value = "";
    if(blocks.length == 0){
        document.getElementById('validation-error-p').innerHTML = "Workspace is empty";
        return false;
    } else if(blocks.length > 1){
        document.getElementById('validation-error-p').innerHTML = "Only the start block is allowed to be placed directly in the workspace";
        return false;
	} else if(blocks[0].type != "block_0"){
        document.getElementById('validation-error-p').innerHTML = "It is compulsory to use the start block (block_0:start)";
        return false;
    } else {
        var allBlocks = this.blocklyWorkspace.getAllBlocks();
        var blocklyValidationResult = true;
        for(var i=0; i<allBlocks.length; i++) {
            blocklyValidationResult = this.validateBlock(allBlocks[i]) && blocklyValidationResult;
        }

        if(blocklyValidationResult) {
            this.generateXML();
        } else {
            document.getElementById('validation-error-p').innerHTML = "not valid";
        }
        return blocklyValidationResult;
    }
}


var parentConnection = {};

XMLToBlocklyWorkspace.prototype.validateEvent = function(event) {
    var hasBlocks = this.blocklyWorkspace.getTopBlocks().length > 0;
    //console.log(event.toJson(), hasBlocks);

    if (!hasBlocks) {
        return;
    }

    if (event.type == Blockly.Events.MOVE) {
        //var block = blocklyWorkspace.getBlockById( event.blockId );
        //console.log(block.type, (block.getParent() ? block.getParent().type : null));
        if (event.newParentId) {
            // A block is moved and attached to another one
            var parentBlock = this.blocklyWorkspace.getBlockById( event.newParentId );
            //console.log("new parent of ", block.type, " is ", parentBlock.type);
            this.validateBlock(parentBlock);
            parentConnection[event.blockId] = parentBlock;
        } else if (parentConnection.hasOwnProperty(event.blockId)) {
            // A block that is supposed to have a parent generates a MOVE
            // event only if it is disconnected from it
            //console.log("disconnect kid of ", parentConnection[event.blockId].type);
            this.validateBlock(parentConnection[event.blockId]);
            delete parentConnection[event.blockId];
        }
    } else if (event.type == Blockly.Events.CREATE) {
        for(var i=0; i<event.ids.length; i++) {
            var block = this.blocklyWorkspace.getBlockById( event.ids[i] );
            this.validateBlock(block);
            if (block.getParent()) {
                parentConnection[block.id] = block.getParent();
            }
        }
    }
}


XMLToBlocklyWorkspace.prototype.validateBlock = function(block){

    var thisBlockErrors     = [];

    function validateStructure(blockValidator, nodeStructure ){     // since blockStructure is recursive, we have to traverse it with a recursive function

        for(var i=0;i<nodeStructure.length;i++){
            var nodeDetails = nodeStructure[i];

            if(nodeDetails.tagName == "slot"){
                var slotName        = nodeDetails.internalName;
                var slotContents    = block.getSlotContentsList(slotName);

                var actualChildrenTypes = slotContents.map( function(childBlock) {return childBlock.type} );
                var thisSlotIsValid     = blockValidator[slotName].validate(actualChildrenTypes)

                if (!thisSlotIsValid) {
                    var fields  = block.getInput(slotName).fieldRow;
                    var pattern = fields[fields.length-1].getText();
                    if (actualChildrenTypes.length) {
                        thisBlockErrors.push("The list '" + actualChildrenTypes.join(",") + "' does not match the pattern '" + pattern + "'");
                    } else {
                        thisBlockErrors.push("The connection '" + pattern + "' cannot be left empty");
                    }
                }

            } else if(   (nodeDetails.tagName == "collapsible")
                     || ((nodeDetails.tagName == "optiField") && (block.getFieldValue(nodeDetails.internalName) == "TRUE"))
                     ||  (nodeDetails.tagName == "element")
                     ||  (nodeDetails.tagName == "attribute")
                     ){
                validateStructure(blockValidator, nodeDetails.content);

            } // ToDo: here is an opportunity to validate specific simple data types
        }
    }

    validateStructure(this.validatorDict[block.type], this.blockStructureDict[block.type]);

    if (thisBlockErrors.length > 0) {
        block.setWarningText( thisBlockErrors.join("\n") );
        return false;
    } else {
        block.setWarningText(null);
        return true;
    }
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
