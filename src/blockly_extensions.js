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

 * ***************************************************************************

    In this file we extend the standard Blockly library with application-specific functionality
    that seems to be core enough to become core extension.
 */


/**
 * Returns the list of all blocks currently inserted&chained into a slot specified by slotName.
 *
 * It is way easier to iterate this way (just one call, and you always get a list, even if empty).
 */
Blockly.Block.prototype.getSlotContentsList = function(slotName) {
    var slotContentsList = [];

    var next = this.getInputTargetBlock(slotName);

    while(next) {
        slotContentsList.push( next );
        next = next.getNextBlock();
    }

    return slotContentsList;
};


/**
 * Returns the list of all statement inputs (slots) available in a block.
 */
Blockly.Block.prototype.getStatementInputNames = function() {
    var statementInputNames = [];

    for (var i = 0, input; input = this.inputList[i]; i++) {
        if(input.type == Blockly.NEXT_STATEMENT) {
            statementInputNames.push(input.name);
        }
    }

    return statementInputNames;
}


/**
 * Returns the array index of an input (line) given the name of the input
 */
Blockly.Block.prototype.findInputIndexByName = function(inputName) {

    for (var i = 0, input; input = this.inputList[i]; i++) {
        if(input.name == inputName) {
            return i;
        }
    }
    alert("Input with name "+inputName+" has not been found!");
}


Blockly.FieldCheckbox.prototype.getInputIndexRange = function() {
	var checkBoxFieldName   = this.name;                                // name of the checkbox field
	var startMarker         = checkBoxFieldName.split("_checkbox")[0];  // name of the collapsiGroup's dummyInput
	var sourceBlock         = this.sourceBlock_;

        //find out at which position of the inputList of sourceBlock the checkbox is present.
    var startIndex  = sourceBlock.findInputIndexByName(startMarker);
    var stopIndex   = sourceBlock.getInput(startMarker).end_of_collapsiGroup_index_;

    return {    'startIndex'    : startIndex,
                'stopIndex'     : stopIndex
    };
}


//function to toggle hide/show collapsiGroup
function collapsiGroup_setter(newState) {

    var inputIndexRange = this.getInputIndexRange();
    var startIndex      = inputIndexRange.startIndex;
    var stopIndex       = inputIndexRange.stopIndex;

	var sourceBlock=this.sourceBlock_;
	var iplist=sourceBlock.inputList;

    /*
     *  If the input field has fieldRow of length 4,
     *  then it means that it's a single level collapsiGroup with no special label
     *  (label of the attibute/element itself is used).
     *
     *  fieldRow indices:
     *      0 : The tree path made of unicode table-building characters
     *      1 : The checkbox
     *      2 : The text label for the field
     *      3 : The text/dropdown field
     */

    if(iplist[startIndex].fieldRow.length == 4) {   // currently that's the way to detect a one-liner collapsiGroup (bit risky)
        iplist[startIndex].fieldRow[3].setVisible(newState);
    } else {
        var labelField  = iplist[startIndex].fieldRow[0];
        if(labelField.getValue().match(/\[\w+\]/)) {
            labelField.setValue(labelField.getValue().replace(/\[\w+\]/, "["+(newState?"less":"more")+"]"));
        }

        for (var currIndex = startIndex+1; currIndex <= stopIndex; currIndex++) {    // scan between startMarker and stopMarker
            var currInput = iplist[currIndex];
            if(currInput.fieldRow.length > 0) {    // skip the marker dummy input lines (they should always stay invisible)
                currInput.setVisible(newState);

                if(newState) {      // when switching back on, do some extra tuning:
                    if(currInput.type == Blockly.NEXT_STATEMENT) {                          // revive the blocks that were hidden
                        var blockList = sourceBlock.getSlotContentsList(currInput.name);
                        for (var i = 0, childBlock; childBlock = blockList[i]; i++) {
                            childBlock.render();
                        }
                    } else if(currInput.fieldRow[1] instanceof Blockly.FieldCheckbox) {     // only show the inner collapsiGroup that are ticked:
                        var innerCheckBoxField      = currInput.fieldRow[1];

                        if(innerCheckBoxField.getValue() == 'FALSE') {
                            if(currInput.fieldRow.length == 4) {
                                currInput.fieldRow[3].setVisible(false);                    // hide only the data field of a one-liner collapsiGroup
                            }

                            currIndex = innerCheckBoxField.getInputIndexRange().stopIndex+1;  // skip to the end of the inner collapsiGroup range
                        }
                    }
                }
            }
        }
    }
    sourceBlock.render();

    return newState;
}
