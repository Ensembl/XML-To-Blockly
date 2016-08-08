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
 * This file contains methods that ensure that the blocks in the Blockly workspace are attached to each other in a valid sequence.
 */


function validateBlocklyGraph(){
	var workspace = Blockly.getMainWorkspace();
    var blocks = workspace.getTopBlocks();
	var allowSaving = true;
    if(blocks.length == 0){
        alert("Workspace is empty");
		return;
    } else if(blocks.length > 1){
		alert("Only the start block is allowed to be placed directly in the workspace");
		return;
	} else{
		var startBlock = blocks[0];
		allowSaving = validateBlock(startBlock);
	}
	if(allowSaving){
		alert("You may save this");
	}
}

//get all blocks. Send each block's slots for validation. Send each child block of each slot for validation
function validateBlock(block){
	var validationResult = true;
	var notchNumbers = notchToBlockMapper[block.type];
	if(notchNumbers){
		for(var i=notchNumbers[0] ; i<notchNumbers[1] ; i++){
			var notch = block.getInput(''+i);
			var slotContentsList = block.getSlotContentsList(notch.name);
			var notchValidationBoolean = validateNotch(notch, i , slotContentsList);
			if( !notchValidationBoolean ){
				validationResult = false;
			}
			for(var j=0;j<slotContentsList.length;j++){
				var blockValidationBoolean = validateBlock(slotContentsList[j]);
				if( !blockValidationBoolean ){
					validationResult = false;
				}
			}
		}
	}
	return validationResult;
}


function validateNotch(notch, notchNumber , slotContents){
	var allClear = true;
	//var notch = block.getInput(''+notchNumber)
	if(notch.connection.targetBlock() == null){
		if( notchProperties[notchNumber].canBeEmpty == false ){
			alert("slot " + notchNumber + " needs to have something in it");
			allClear = false;
		}
	} else{
		if(notchProperties[notchNumber].isRepeatable){
			if(notchProperties[notchNumber].isGrouped){   // one/zeroOrMore has interleave as only child

			} else{                             // one/zeroOrMore has choice, optional as only child

			}
		} else{
			if(notchProperties[notchNumber].isGrouped){    // interleave notch notch

			} else{                              //optional, choice notch
				allClear = validateChoiceNotch(notch.name, slotContents);
			}
		}
	}
	return allClear;
}


function validateChoiceNotch(notchName, slotContents){
	var expectedChildren = JSON.parse( JSON.stringify( notchProperties[notchName].childrenInfo ) );
    var actualChildren = getPrettyNamesOfSlotContents(slotContents);
	if( actualChildren.length == 1 ){
        if( expectedChildren.indexOf( actualChildren[0] ) != -1 ){  //if child is directly mentioned in expectedChildren, it is not an interleave
			return true;
        }
    }

    if( isRepetitiveChild( expectedChildren , actualChildren[0]) ){ //choice has a oneOrMore child
        var iterator = 1;
        while( iterator < actualChildren.length ){
            if( actualChildren[0] == actualChildren[iterator] ){
                iterator++;
                continue;
            } else{
                alert("Please attach only one type of repetitive block");
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
            alert("The interleave has not been implemented properly.");
            return false;
        } else{ //if block occurs multiple times but is neither a repetitive nor interleave block
			alert("You cannot attach this block more than once");
			return false;
		}
    }
	return true;
}


function isRepetitiveChild(expectedChildren , name){
    var ans = false;
    var index = expectedChildren.indexOf(name);
    var i = index-1;
    while(i>=0){
        if( expectedChildren[i] == "startRepetition_" ){
            break;
        }
        i--;
    }
    if(i>=0){
        while(i<expectedChildren.length){
            if( expectedChildren[i] == "_endRepetition" ){
                break;
            }
            i++;
        }
        if(i>index && i!=expectedChildren.length){
            ans = true;
        }
    }
    return ans;
}


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
		ans.push( blockNameToDisplayNameMapper[blockArray[i].type] );
	}
	return ans;
}
