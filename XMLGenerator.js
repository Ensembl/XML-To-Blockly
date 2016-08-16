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

/*
 * This file consists of mehods that help us in generating XML from the blocks in the editor workspace
 */

var xmlDoc;
var keys;
var values;

//initializes some globals.
function generateXML(){
	xmlDoc = document.implementation.createDocument('http://relaxng.org/ns/structure/1.0', 'xml' , null );
	keys = [];
	values = [];
	console.log(xmlDoc);
	var startBlock = Blockly.getMainWorkspace().getTopBlocks()[0];
	console.log(startBlock);
	handleBlock(startBlock);
	console.log(keys);
	console.log(values);
}

/* This function decides the order in which blocks should be traversed.
 * (We visit the block, and then call the block connected to its bottom notch, if any)
 */
function handleBlock(block){
	handleInputs(block.inputList, block);
	var next = block.getNextBlock();
	if(next){
		handleBlock(next);
	}
}

/* This function receives the inputList of a block.
 * It iterates through the list and takes actions depending on whether theere is a statementInput or not
*/
function handleInputs(inputList , block){
	for(var i=1;i<inputList.length;i++){
		if(inputList[i].type ==  Blockly.NEXT_STATEMENT){
			console.log(inputList[i]);
			var attachedBlock = block.getInputTargetBlock(inputList[i].name);
			handleBlock(attachedBlock);
		} else{
			handleRow(inputList[i].fieldRow);
		}
	}
}

/* This function goes through each row in the block and collects data from them.
 * It stores the data in arrays called keys and values
 */
function handleRow(row){
	var foundTextArea = false;
	var nodeValue, nodeName;
	if(row[ row.length-1 ] instanceof Blockly.FieldTextInput){
		nodeValue = row[ row.length-1 ].text_;
		values.push(nodeValue);
		nodeName = row[ row.length-2 ].text_;
		keys.push(nodeName);
	} else{
		var elementName = row[ row.length-1 ].text_;
		keys.push(elementName);
		values.push("");
	}
}
