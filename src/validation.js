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
    var blocks = blocklyWorkspace.getTopBlocks();

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
        var allBlocks = blocklyWorkspace.getAllBlocks();
        var blocklyValidationResult = true;
        for(var i=0; i<allBlocks.length; i++) {
            blocklyValidationResult = validateBlock(allBlocks[i]) && blocklyValidationResult;
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

function validateEvent(event) {
    var hasBlocks = blocklyWorkspace.getTopBlocks().length > 0;
    //console.log(event.toJson(), hasBlocks);

    if (!hasBlocks) {
        return;
    }

    if (event.type == Blockly.Events.MOVE) {
        //var block = blocklyWorkspace.getBlockById( event.blockId );
        //console.log(block.type, (block.getParent() ? block.getParent().type : null));
        if (event.newParentId) {
            // A block is moved and attached to another one
            var parentBlock = blocklyWorkspace.getBlockById( event.newParentId );
            //console.log("new parent of ", block.type, " is ", parentBlock.type);
            validateBlock(parentBlock);
            parentConnection[event.blockId] = parentBlock;
        } else if (parentConnection.hasOwnProperty(event.blockId)) {
            // A block that is supposed to have a parent generates a MOVE
            // event only if it is disconnected from it
            //console.log("disconnect kid of ", parentConnection[event.blockId].type);
            validateBlock(parentConnection[event.blockId]);
            delete parentConnection[event.blockId];
        }
    } else if (event.type == Blockly.Events.CREATE) {
        for(var i=0; i<event.ids.length; i++) {
            var block = blocklyWorkspace.getBlockById( event.ids[i] );
            validateBlock(block);
            if (block.getParent()) {
                parentConnection[block.id] = block.getParent();
            }
        }
    }
}

//get all blocks. Send each block's slots for validation. Send each child block of each slot for validation
function validateBlock(block){
    //console.log("validateBlock(", block.type, block.id, ")");
    var availableNotchNumbers   = block.getStatementInputNames();
    var thisBlockErrors         = [];

    for(var i=0; i<availableNotchNumbers.length; i++) {
        var notchNumber         = availableNotchNumbers[i];
        var slotContents        = block.getSlotContentsList(notchNumber);
        var errorContext        = block.type+", slot #"+(i+1);  // not a unique context, but will do for now; the slot# makes sense as a local base-1 number

        var actualChildren = getBlockTypesOfSlotContents(slotContents);
        var thisNotchIsValid = validatorDict[block.type][notchNumber].validate(actualChildren)
        //console.log("notch", notchNumber, actualChildren, validatorDict[block.type][notchNumber], thisNotchIsValid );

        if (!thisNotchIsValid) {
            var fields = block.getInput(notchNumber).fieldRow;
            if (actualChildren.length) {
                thisBlockErrors.push("The list '" + actualChildren.join(",") + "' does not match the pattern '" + fields[fields.length-1].getText() + "'");
            } else {
                thisBlockErrors.push("The connection '" + fields[fields.length-1].getText() + "' cannot be left empty");
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

function getBlockTypesOfSlotContents(blockArray){
	var ans = [];
	for(var i=0; i<blockArray.length; i++){
		ans.push( blockArray[i].type );
	}
	return ans;
}
