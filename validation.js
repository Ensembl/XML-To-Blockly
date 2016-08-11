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

    This file contains methods that ensure that the blocks in the Blockly workspace are attached to each other in a valid sequence.
 */


function validateBlocklyGraph(){
    var blocks = Blockly.getMainWorkspace().getTopBlocks();

    if(blocks.length == 0){
        alert("Workspace is empty");
        return false;
    } else if(blocks.length > 1){
		alert("Only the start block is allowed to be placed directly in the workspace");
        return false;
	} else {
        var blocklyValidationResult = validateBlock(blocks[0]);

        if(blocklyValidationResult) {
            alert("You may save this");
        }
        return blocklyValidationResult;
    }
}

//get all blocks. Send each block's slots for validation. Send each child block of each slot for validation
function validateBlock(block){
	var blockValidationResult   = true;
    var availableNotchNumbers   = block.getStatementInputNames();

    for(var i=0; i<availableNotchNumbers.length; i++) {
        var notchNumber         = availableNotchNumbers[i];
        var slotContents        = block.getSlotContentsList(notchNumber);
        var thisNotchProperties = notchProperties[notchNumber];
        var errorContext        = block.type+", slot #"+(i+1);  // not a unique context, but will do for now; the slot# makes sense as a local base-1 number

        blockValidationResult = validateNotch(slotContents, thisNotchProperties, errorContext) && blockValidationResult; // check if the notch is correctly populated

        for(var j=0;j<slotContents.length;j++){
            blockValidationResult = validateBlock(slotContents[j]) && blockValidationResult; // check each of the child blocks in turn
        }
    }
	return blockValidationResult;
}


function validateNotch(slotContents, thisNotchProperties, errorContext){
	var notchValidationResult = true;

	if(slotContents.length == 0) {
        notchValidationResult = thisNotchProperties.canBeEmpty;

        if(! notchValidationResult) {
			alert( errorContext + " needs to have something in it");
		}
	} else{
        console.log(thisNotchProperties);
        //compulsorily check shouldHaveOneBlock so that we do not end up trying to validate a oneOrMore notch
		if(thisNotchProperties.isRepeatable){
			if(thisNotchProperties.isGrouped){   // one/zeroOrMore has interleave as only child

			} else if(thisNotchProperties.shouldHaveOneBlock){                             // one/zeroOrMore has choice, optional as only child
                notchValidationResult = validateMutatedChoiceNotch(slotContents, thisNotchProperties, errorContext);
			}
		} else{
			if(thisNotchProperties.isGrouped){    // interleave notch notch

			} else if(thisNotchProperties.shouldHaveOneBlock){                              //optional, choice notch
				notchValidationResult = validateChoiceNotch(slotContents, thisNotchProperties, errorContext);
			}
		}
	}
	return notchValidationResult;
}


function validateChoiceNotch(slotContents, thisNotchProperties, errorContext){
	var expectedChildren = JSON.parse( JSON.stringify( thisNotchProperties.childrenInfo ) );
    var actualChildren = getPrettyNamesOfSlotContents(slotContents);
	if( actualChildren.length == 1 && expectedChildren.indexOf( actualChildren[0] ) != -1){ //if child is directly mentioned in expectedChildren, it is not an interleave
			return true;
    }

    if( isRepetitiveChild( expectedChildren , actualChildren[0]) ){ //choice has a oneOrMore child
        var iterator = 1;
        while( iterator < actualChildren.length ){
            if( actualChildren[0] == actualChildren[iterator] ){
                iterator++;
                continue;
            } else{
                alert( errorContext + ": please attach only one type of repetitive block");
                return false;
            }
        }
    } else{
        var interleaveLists = isInterleaveChild(expectedChildren , actualChildren[0]);
        if(interleaveLists.length>0){   //choice has an interleave child
            for(var i=0;i<interleaveLists.length;i++){
                var currentList = JSON.parse(interleaveLists[i]);
                var ans = false;
                if(currentList.length != actualChildren.length){
                    /*if we have two interleaves in the choice [a,b] and [a,b,c],
                     *then we proceed ahead only for that list which has the same number of elements as the current notch
                     */
                     ans = false;
                    continue;
                }
                ans = true;
                while(currentList.length!=0){   //we may be missing interleave containing a repetitive block
                    if( actualChildren.indexOf(currentList[0]) != -1 ){
                        currentList.splice(0,1);
                    } else{
                        ans = false;
                        break;
                    }
                }
                if(ans == true){
                    return true;
                }
            }
            alert( errorContext + ": the interleave has not been implemented properly.");
            return false;
        } else{ //if block occurs multiple times but is neither a repetitive nor interleave block
			alert( errorContext + ": you cannot attach this block more than once");
			return false;
		}
    }
	return true;
}


function validateMutatedChoiceNotch(slotContents, thisNotchProperties, errorContext){
    var expectedChildren = JSON.parse( JSON.stringify( thisNotchProperties.childrenInfo ) );
    var actualChildren = getPrettyNamesOfSlotContents(slotContents);
    if( actualChildren.length == 1 && expectedChildren.indexOf( actualChildren[0] ) != -1){ //if child is directly mentioned in expectedChildren, it is not an interleave
			return true;
    }

    for(var i =0;i<actualChildren.length;i++){
        if( expectedChildren.indexOf(actualChildren[i]) == -1 ){
            var interleaveLists = isInterleaveChild(expectedChildren, actualChildren[i]);
            var lastIndexOfInterleave;

            for(var j=0;j<interleaveLists.length;j++){
                lastIndexOfInterleave = checkInterleave( interleaveLists[j], JSON.stringify(actualChildren), i );
                if(lastIndexOfInterleave != -1){
                    i = lastIndexOfInterleave;  //i is now at the index where the successful interleave ends.
                    break;
                }
            }//end of checking all interleave lists

            if(lastIndexOfInterleave == -1){
                alert(errorContext + ": Interleave has not been implemented properly");
                return false;
            }
        }//out of if interleave child condition
    }//finished going through all the children
    return true;
}

// checks if the array has an interleave from the current child onwards. Returns an index indicating till what position the interleave children continue
function checkInterleave(interleaveList, array, startIndex){
    var ans;
    var interleaveChildren = JSON.parse(interleaveList);
    var actualChildren = JSON.parse(array);
    for(var i=startIndex;i<actualChildren.length;i++){
        var index = interleaveChildren.indexOf(actualChildren[i]);
        if( index != -1 ){
            interleaveChildren.splice(index,1);
        } else{
            return -1;
        }

        if(interleaveChildren.length == 0){
            return i;
        }
    }

    //loop to handle an interleave child that may also be a simple block without interleave in choice Eg.[first, [first, second]]
    while(startIndex > 0){
        startIndex--;
        var index = interleaveChildren.indexOf(actualChildren[startIndex]);
        if( index != -1 ){
            interleaveChildren.splice(index,1);
        } else{
            return -1;
        }

        if(interleaveChildren.length == 0){
            return startIndex;
        }
    }
    return -1;
}


function isRepetitiveChild(expectedChildren, name){
    var index = expectedChildren.indexOf(name);
    var ans = (expectedChildren[index-1] == "startRepetition_" && expectedChildren[index+1] == "_endRepetition") ? true : false;
    console.log(ans);
    return ans;
}

//checks if current block name belongs to some interleave
function isInterleaveChild( expectedChildren , name ){
    var listsThatChildCanBePartOf = [];
    for(var i=0;i<expectedChildren.length;i++){
        if( Object.prototype.toString.call ( expectedChildren[i] ) === "[object Array]" ){
            if(expectedChildren[i].indexOf(name) != -1 ){
                listsThatChildCanBePartOf.push(JSON.stringify(expectedChildren[i]));
            }
        }
    }
    return listsThatChildCanBePartOf;

}


function getPrettyNamesOfSlotContents(blockArray){
	var ans = [];
	for(var i=0; i<blockArray.length; i++){
		ans.push( blockTypeToDisplayNameMapper[blockArray[i].type] );
	}
    console.log(ans);
	return ans;
}
