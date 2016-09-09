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

function XMLGenerator(blockStructureDict){
	this.XMLDoc = "";
	this.blockStructureDict = blockStructureDict;
	this.generateXMLDoc();
}


/* Entry point for generating XML.
 * Initializes final XML document and initiates call for XML generation
 */
XMLGenerator.prototype.generateXMLDoc = function(){
	this.XMLDoc = document.implementation.createDocument( '', '' , null );
	var startBlock= blocklyWorkspace.getTopBlocks()[0];
	var structure = this.blockStructureDict[startBlock.type];
	for(var i=0;i<structure.length;i++){
		var data = this.generateXMLFromStructure( structure[i] , startBlock );
		for(var j=0;j<data.length;j++){
			this.XMLDoc.appendChild( data[j] );
		}
	}
	console.log(this.XMLDoc);
	return;
}


// Recursive function to generate XML
XMLGenerator.prototype.generateXMLFromStructure = function( obj , block ){
	if(obj.tagName == "text"){
		var textNode = this.XMLDoc.createTextNode( block.getFieldValue(obj.internalName) );
		return [textNode];
	} else if(obj.tagName == "element"){
		var ele = this.XMLDoc.createElement(obj.displayName);
		var content = obj.content;
		for(var i=0;i<content.length;i++){
			var data = this.generateXMLFromStructure( content[i] , block );
			for(var j=0;j<data.length;j++){
				//console.log(data[j].nodeType);
				var type = data[j].nodeType;
				if(type == 2){	//child is attribute
					ele.setAttributeNode(data[j]);
				} else if(type == 3 || type == 1){	//3: text node , 1: element
					ele.appendChild(data[j]);
				} else{
					alert("Don't know node type " + type + " yet");
				}
			}
		}
		return [ele];
	} else if(obj.tagName == "attribute"){
		var attr = this.XMLDoc.createAttribute(obj.displayName);
		var data = this.generateXMLFromStructure( obj.content[0] , block )[0].nodeValue;	//Should we be sending content[0] directly and assuming that the array received is of length 1?
		attr.value = data;
		return [attr];
	} else if(obj.tagName == "slot"){
		var blocksInSlot = block.getSlotContentsList(obj.internalName);
		var dataToReturn = [];
		for(var i=0;i<blocksInSlot.length;i++){
			var blockStructure = this.blockStructureDict[ blocksInSlot[i].type ];
			for(var j=0;j<blockStructure.length;j++){
				var data = this.generateXMLFromStructure( blockStructure[j] , blocksInSlot[i] );
				//console.log(data);
				dataToReturn.push.apply( dataToReturn , data );
			}
		}
		//console.log(dataToReturn);
		return dataToReturn;
	} else if(obj.tagName == "optiField"){
		var checkboxValue = block.getFieldValue(obj.internalName);
		if(checkboxValue == "TRUE"){
			var content = obj.content;
			var dataToReturn = [];
			for(var i=0;i<content.length;i++){
				var data = this.generateXMLFromStructure( content[i] , block );
				dataToReturn.push.apply(dataToReturn , data);
			}
			return dataToReturn;
		} else{
			return [];
		}
	}
}
