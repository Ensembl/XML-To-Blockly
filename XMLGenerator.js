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


var XMLDoc = "";


/* Entry point for generating XML.
 * Initializes final XML document and initiates call for XML generation
 */
function generateXML(){
	XMLDoc = document.implementation.createDocument( 'http://relaxng.org/ns/structure/1.0', 'xml' , null );
	var XMLStartNode = XMLDoc.documentElement;
	var startBlock= blocklyWorkspace.getTopBlocks()[0];
	var structure = blockStructureDict[startBlock.type];
	for(var i=0;i<structure.length;i++){
		var data = generateXMLFromStructure( structure[i] , startBlock );
		XMLStartNode.appendChild(data);
	}
	console.log(XMLDoc);
}


// Recursive function to generate XML
function generateXMLFromStructure( obj , block ){
	if(obj.tagName == "text"){
		var textNode = XMLDoc.createTextNode( block.getFieldValue(obj.internalName) );
		return textNode;
	} else if(obj.tagName == "element"){
		var ele = XMLDoc.createElement(obj.displayName);
		var content = obj.content;
		for(var i=0;i<content.length;i++){
			var data = generateXMLFromStructure( content[i] , block );
			console.log(data.nodeType);
			var type = data.nodeType;
			if(type == 2){	//child is attribute
				ele.setAttributeNode(data);
			} else if(type == 3 || type == 1){	//3: text node , 1: element
				ele.appendChild(data);
			} else{
				alert("Don't know node type " + type + " yet");
			}
		}
		return ele;
	} else if(obj.tagName == "attribute"){
		var attr = XMLDoc.createAttribute(obj.displayName);
		var data = generateXMLFromStructure( obj.content[0] , block ).nodeValue;	//Should we be sending content[0] directly?
		attr.value = data;
		return attr;
	}
}

/*
var XMLDoc;
var nodes;
var nodeValues;

//initializes some globals.
function generateXML(){
	console.log(cleanRNG);
	XMLDoc = document.implementation.createDocument('http://relaxng.org/ns/structure/1.0', 'xml' , null );
	nodes = [];
	nodeValues = [];
	console.log(XMLDoc);
	var startBlock = Blockly.getMainWorkspace().getTopBlocks()[0];
	console.log(startBlock);
	handleBlock(startBlock);
	console.log(nodes);
	console.log(nodeValues);
	var RNGStartNode = cleanRNG.getElementsByTagName("start")[0];
	var XMLStartNode = XMLDoc.documentElement;
	createXML(RNGStartNode , XMLStartNode);
	console.log(XMLDoc);
	var XMLToString = new XMLSerializer().serializeToString(XMLDoc);
	document.getElementById("XMLOutput").value = XMLToString;
}*/

/* This function decides the order in which blocks should be traversed.
 * (We visit the block, and then call the block connected to its bottom notch, if any)
 */
/*function handleBlock(block){
	handleInputs(block.inputList, block);
	var next = block.getNextBlock();
	if(next){
		handleBlock(next);
	}
}*/

/* This function receives the inputList of a block.
 * It iterates through the list and takes actions depending on whether theere is a statementInput or not
*/
/*function handleInputs(inputList , block){
	for(var i=1;i<inputList.length;i++){
		if(inputList[i].type ==  Blockly.NEXT_STATEMENT){
			console.log(inputList[i]);
			var attachedBlock = block.getInputTargetBlock(inputList[i].name);
			if(attachedBlock){
				handleBlock(attachedBlock);
			}
		} else{
			handleRow(inputList[i].fieldRow);
		}
	}
}*/

/* This function goes through each row in the block and collects data from them.
 * It stores the data in arrays called nodes and nodeValues
 */
/*function handleRow(row){
	var foundTextArea = false;
	var nodeValue, nodeName;
	if(row[ row.length-1 ] instanceof Blockly.FieldTextInput){
		nodeValue = row[ row.length-1 ].text_;
		nodeValues.push(nodeValue);
		nodeName = row[ row.length-2 ].text_;
		nodes.push(nodeName);
	} else{
		var elementName = row[ row.length-1 ].text_;
		nodes.push(elementName);
		nodeValues.push("");
	}
}*/

/* This function parses RNG nodes and creates the corresponding XML for them.
 * The RNGNode and XMLParent parameters are at the same level in the RNG file and output XML respectively
 */
/*function createXML(RNGNode , XMLParent){
	var name = RNGNode.getAttribute("name");
	if(name != null){
		if(RNGNode.nodeName == "attribute"){
			var currentName = nodes.shift();
			var currentValue = nodeValues.shift();
			XMLParent.setAttribute(currentName , currentValue);
			return;	//as attribute won't have any children
		} else if(RNGNode.nodeName == "element"){
			var currentName = nodes.shift();
			var currentValue = nodeValues.shift();
			var ele = XMLDoc.createElement(currentName);
			if(currentValue != ""){
				var textNode = XMLDoc.createTextNode(currentValue);
				ele.appendChild(textNode);
				XMLParent.appendChild(ele);
				return;
			}
			XMLParent.appendChild(ele);
			var newParent = XMLDoc.getElementsByTagName(name);
			newParent = newParent[ newParent.length-1 ];
			var children = RNGNode.childNodes;
			for(var i=0;i<children.length;i++){
				createXML(children[i] , newParent);
			}
		} else{
			alert("Cannot handle "+RNGNode.nodeName+" yet");
		}
	} else{
		if(RNGNode.nodeName == "text"){
			var currentName = nodes.shift();
			var currentValue = nodeValues.shift();
			var textNode = XMLDoc.createTextNode(currentValue);
			XMLParent.appendChild(textNode);
			return;
		}
		var children = RNGNode.childNodes;
		for(var i=0;i<children.length;i++){
			createXML(children[i] , XMLParent);
		}
	}
}
*/
