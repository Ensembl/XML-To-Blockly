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

/* ***************************************************************************

    This file contains methods that ensure that the blocks in the Blockly workspace are attached to each other in a valid sequence.
 */


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
            document.getElementById('validation-error-p').innerHTML = "";
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

//get all blocks. Send each block's slots for validation. Send each child block of each slot for validation
XMLToBlocklyWorkspace.prototype.validateBlock = function(block){
    var availableSlotNames  = block.getStatementInputNames();
    var thisBlockErrors     = [];

    for(var i=0; i<availableSlotNames.length; i++) {
        var slotName        = availableSlotNames[i];
        var slotContents    = block.getSlotContentsList(slotName);

        var actualChildrenTypes = slotContents.map( function(childBlock) {return childBlock.type} );
        var thisSlotIsValid     = this.validatorDict[block.type][slotName].validate(actualChildrenTypes)

        if (!thisSlotIsValid) {
            var fields  = block.getInput(slotName).fieldRow;
            var pattern = fields[fields.length-1].getText();
            if (actualChildrenTypes.length) {
                thisBlockErrors.push("The list '" + actualChildrenTypes.join(",") + "' does not match the pattern '" + pattern + "'");
            } else {
                thisBlockErrors.push("The connection '" + pattern + "' cannot be left empty");
            }
        }
    }

    if (thisBlockErrors.length > 0) {
        block.setWarningText( thisBlockErrors.join("\n") );
        return false;
    } else {
        block.setWarningText(null);
        return true;
    }
}

