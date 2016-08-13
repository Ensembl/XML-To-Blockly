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
                notchValidationResult = validateInterleaveNotch(slotContents, thisNotchProperties, errorContext);
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
        actualChildren.sort();
        var interleaveLists = isInterleaveChild(expectedChildren , actualChildren[0]);
        if(interleaveLists.length>0){   //choice has an interleave child
            for(var i=0;i<interleaveLists.length;i++){
                var currentList = JSON.parse(interleaveLists[i]);
                var ans = false;
                currentList.sort();
                ans = (currentList.length == actualChildren.length) && (currentList.every(function(element, index){ return element == actualChildren[index]; }));
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

/*
function validateInterleaveNotch(slotContents, thisNotchProperties, errorContext){
    var expectedChildren = JSON.parse( JSON.stringify( thisNotchProperties.childrenInfo ) );
    var actualChildren = getPrettyNamesOfSlotContents(slotContents);

    var repetitiveChildren = getAllRepetitiveChildren(expectedChildren);
    var choiceChildren = getAllChoiceChildren(expectedChildren);
    var interleaveLists = getAllInterleaveChildren(expectedChildren) ;

    for(var i=0;i<actualChildren.length;i++){
        if(expectedChildren.indexOf(actualChildren[i]) == "__CHILD_REMOVED__"){
            alert(errorContext + " : " + actualChildren[i] + " cannot be used multiple times");
            return false;
        } else if(expectedChildren.indexOf(actualChildren[i]) != -1){  //normal child of interleave
            var index = expectedChildren.indexOf(actualChildren[i]);
            expectedChildren[index] = "__CHILD_REMOVED__";
            continue;
        } else if(repetitiveChildren[0].indexOf(actualChildren[i]) != -1 || repetitiveChildren[0].indexOf(actualChildren[i]) != -1 || repetitiveChildren[0].indexOf(actualChildren[i]) != -1){
            var index,j;
            for(j=0;j<3;j++){
                if(repetitiveChildren[j].indexOf(actualChildren[i]) != -1){
                    index = repetetitiveChildren[j].indexOf(actualChildren[i]);
                    break;
                }
            }
            var childName = actualChildren[i];
            while(i<actualChildren.length){
                if(actualChildren[i] == childName){
                    i++;
                } else{
                    i--;
                    break;
                }
            }
            repetitiveChildren[j].splice(index,1);
        } else if( interleaveLists.length>0 ){
            for(var j=0;j<interleaveLists.length;j++){
                var currentList = JSON.parse(interleaveLists[j]);
                var len = currentList.length;
                var partOfActualChildren = actualChildren.slice(i,i+len);
                console.log(currentList.length);

                currentList.sort();
                partOfActualChildren.sort();

                var properInterleave = ( (currentList.length == partOfActualChildren.length) && currentList.every(function(element, index){return element == partOfActualChildren[index];}) );

                if(properInterleave == true){
                    i+=len-1;
                    interleaveLists[j] = [];
                    break;
                }
            }
            if( !properInterleave ){
                alert(errorContext + " : Interleave has not been implemented correctly");
                return false;
            }
        } else {
            checkAndRemoveChoice(expectedChildren[i] , choiceChildren);
        }
    }

    console.log(expectedChildren);
    var ans = checkRemainingChildren(expectedChildren, repetitiveChildren, choiceChildren, interleaveLists);
    return ans;

    //check the expectedchildren list to find out if the interleave was implemented properly
}*/


function validateInterleaveNotch(slotContents, thisNotchProperties, errorContext){
    var validationResponse = true;
    var expectedChildren = JSON.parse( JSON.stringify( thisNotchProperties.childrenInfo ) );
    var actualChildren = getPrettyNamesOfSlotContents(slotContents);

    var choiceChildren = getAllChoiceChildren(expectedChildren);
    var interleaveLists = getAllInterleaveChildren(expectedChildren) ;
    var repetitiveChildren = getAllRepetitiveChildren(expectedChildren);
    var oneOrMoreChildren =  repetitiveChildren[0];
    var zeroOrMoreChildren = repetitiveChildren[1];
    var optionalChildren = repetitiveChildren[2];

    for(var i=0;i<interleaveLists.length;i++){  //validate 'interleave' children of current interleave first. remove them from actualChildren. Remove from interleaveLists as well
        var currentList = interleaveLists[i];
        var len = currentList.length;
        for(var j=0;j<=actualChildren.length-len;j++){
            var partOfActualChildren = actualChildren.slice(j,j+len);
            partOfActualChildren.sort();
            if( currentList.every(function(element, index){ return element == partOfActualChildren[index]; }) ){
                interleaveLists.splice(i, 1);
                actualChildren.splice(j, len);
                i--;
                break;
            }
        }
    }

    for(var i=0;i<expectedChildren.length;i++){     //validate immediate children of interleave being checked. Remove them from actual and expected lists
        var index = actualChildren.indexOf( expectedChildren[i] );
        if( index != -1){
            expectedChildren.splice(i,1);
            actualChildren.splice(index,1);
            i--;
        } else{
            alert(errorContext + ":" + expectedChildren[i] + " needs to be used" );
            validationResponse = false;
        }
    }

    for(var i=0;i<oneOrMoreChildren.length;i++){
        var index = actualChildren.indexOf(oneOrMoreChildren[i]);
        if(index == -1){
            alert(errorContext + ":" + oneOrMoreChildren[i] + " needs to be used at least once");
            validationResponse = false;
        } else{
            var startIndex = index;
            while(actualChildren[index] == oneOrMoreChildren[i]){
                index++;
            }
            actualChildren.splice(startIndex, index-startIndex);
            oneOrMoreChildren.splice(i,1);
            i--;
        }
    }

    for(var i=0;i<actualChildren.length;i++){   //check after loop if choiceChildren length is 0
        for(var j=0;j<choiceChildren.length;j++){
            if(choiceChildren[j].indexOf(actualChildren[i]) != -1){
                choiceChildren.splice(j,1);
                actualChildren.splice(i,1);
                i--;
                break;
            }
        }
        if(choiceChildren.length == 0){
            break;
        }
    }

    if(choiceChildren.length > 0){
        for(var i=0;i<choiceChildren.length;i++){
            alert(errorContext + " : " + "Please choose at least one block from : "+choiceChildren[i]);
        }
    }

    for(var i=0;i<actualChildren.length;i++){
        var index = optionalChildren.indexOf(actualChildren[i]);
        if( index != -1 ){
            actualChildren.splice(i,1);
            optionalChildren.splice(index,1);
            i--;
        } else{
            index = zeroOrMoreChildren.indexOf(actualChildren[i]);
            if(index != -1){
                var startIndex = i;
                while(actualChildren[i] == zeroOrMoreChildren[index]){
                    i++;
                }
                actualChildren.splice(startIndex, i-startIndex);
                zeroOrMoreChildren.splice(index,1);
                i = startIndex-1;
            }
        }
    }

    if(actualChildren.length != 0){
        alert(errorContext + " : " + " The following extra blocks were found : " + actualChildren);
        validationResponse = false;
    }

    if(interleaveLists.length != 0){
        for(var i=0;i<interleaveLists.length;i++){
            alert(errorContext + " : " + "The following interleave has not been implemented correctly: " + interleaveLists[i] );
        }
    }
    console.log(expectedChildren);
    return validationResponse;
}


function checkRemainingChildren(expectedChildren, repetitiveChildren, choiceChildren, interleaveLists){
    var ans = true;
    for(var i=0;i<expectedChildren.length;i++){
        if( !(expectedChildren[i] == "__CHILD_REMOVED__" || (Object.prototype.toString.call ( expectedChildren[i] ) === "[object Array]")) ){
            alert(expectedChildren[i] + " should be used at least once");
            ans = false;
        }
    }
    for(var i=0;i<repetitiveChildren[0].length;i++){
        if(repetitiveChildren[i] != "__CHILD_REMOVED__"){
            alert(expectedChildren[i] + " should be used at least once");
            ans = false;
        }
    }
    for(var i=0;i<choiceChildren.length;i++){
        console.log(choiceChildren[i]);
    }
    return ans;
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


function checkAndRemoveChoice(name , listOfLists){
    for(var i=0; i<listOfLists.length;i++){
        if(listOfLists[i].indexOf(name) != -1){
            listOfLists[i] = [];
            return true;
        }
    }
    return false;
}


function isRepetitiveChild(expectedChildren, name){
    var index = expectedChildren.indexOf(name);
    var repetitiveTypes = [ 'startRepetition_oneOrMore' , 'startRepetition_zeroOrMore' ];
    if(index == 0){
        return false;
    }
    var ans = ( repetitiveTypes.indexOf(expectedChildren[index-1]) != -1 ) ? true : false;
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

/* finds all the children that belong to various "choice" nodes.
 * Returns a list of lists where each list represents a choice node's children.
 * The marking of __CHILD_REMOVED__ will be handled by checkValidityOfRemainingChildren() which is yet to be implemented
 */
function getAllChoiceChildren(expectedChildren){
    var listOfAllChoices = [];
    var currentList = [];
    var addChoiceChild = false;
    var startIndex = -1;
    var endIndex = -1;
    for(var i=0;i<expectedChildren.length;i++){
        if( expectedChildren[i] == "startChoice_" ){
            addChoiceChild = true;
            startIndex = i;
            continue;
        }

        if(expectedChildren[i] == "_endChoice"){
            addChoiceChild = false;
            endIndex = i;
            expectedChildren.splice(startIndex,endIndex-startIndex+1);
            i = startIndex-1;
            listOfAllChoices.push(currentList);
        }

        if(addChoiceChild){
            currentList.push(expectedChildren[i]);
        }
    }

    return listOfAllChoices;
}

/* Returns optional, oneOrMore and zeroOrMore children.
 * listOfAllRepetitiveChildren contains three lists - first for oneOrMore children, second for zeroOrMore and third for optional children
 */
function getAllRepetitiveChildren(expectedChildren){
    var listOfAllRepetitiveChildren = [ [] , [] , [] ];     //[ [oneOrMore kids] , [zeroOrMore kids] , [optional kids] ]
    var repetitiveTypes = [ 'startRepetition_oneOrMore' , 'startRepetition_zeroOrMore' , 'startRepetition_optional' ];
    var removeChild = false;
    var index = -1;
    var startIndex = -1;
    var endIndex = -1;
    for(var i=0;i<expectedChildren.length;i++){
        if( !removeChild ){
            index = repetitiveTypes.indexOf(expectedChildren[i]);
            if(index != -1){
                removeChild = true;
                startIndex = i;
                continue;
            }
        }

        if(removeChild){
            if(expectedChildren[i] == "_endRepetition"){
                removeChild = false;
                endIndex = i;
                expectedChildren.splice(startIndex,endIndex-startIndex+1);
                i = startIndex-1;
            } else{
                listOfAllRepetitiveChildren[index].push(expectedChildren[i]);
            }
        }
    }
    return listOfAllRepetitiveChildren;
}


function getAllInterleaveChildren(expectedChildren){
    var listOfAllInterleaves = [];
    for(var i=0;i<expectedChildren.length;i++){
        if(Object.prototype.toString.call ( expectedChildren[i] ) === "[object Array]"){
            expectedChildren[i].sort();
            listOfAllInterleaves.push(expectedChildren[i]);
            expectedChildren.splice(i,1);
            i--;
        }
    }
    return listOfAllInterleaves;
}


function getPrettyNamesOfSlotContents(blockArray){
	var ans = [];
	for(var i=0; i<blockArray.length; i++){
		ans.push( blockTypeToDisplayNameMapper[blockArray[i].type] );
	}
    console.log(ans);
	return ans;
}
