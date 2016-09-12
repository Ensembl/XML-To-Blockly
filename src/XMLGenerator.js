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

function XMLGenerator(blockStructureDict , blocklyWorkspace){
	this.XMLDoc = "";
	this.blocklyWorkspace = blocklyWorkspace;
	this.blockStructureDict = blockStructureDict;
	this.generateXMLDoc();
}


/* Entry point for generating XML.
 * Initializes final XML document and initiates call for XML generation
 */
XMLGenerator.prototype.generateXMLDoc = function(){
	this.XMLDoc = document.implementation.createDocument( '', '' , null );
	var startBlock= this.blocklyWorkspace.getTopBlocks()[0];
	var structure = this.blockStructureDict[startBlock.type];
	for(var i=0;i<structure.length;i++){
		var inputChunks = this.generateXMLFromStructure( structure[i] , startBlock );
		for(var j=0;j<inputChunks.length;j++){
			this.XMLDoc.appendChild( inputChunks[j] );
		}
	}
	console.log(this.XMLDoc);
	return;
}


// Recursive function to generate XML
XMLGenerator.prototype.generateXMLFromStructure = function( nodeDetails , block ){
	if(nodeDetails.tagName == "text"){
		var textNode = this.XMLDoc.createTextNode( block.getFieldValue(nodeDetails.internalName) );
		return [textNode];
	} else if(nodeDetails.tagName == "element"){
		var ele = this.XMLDoc.createElement(nodeDetails.xmlName);
		var content = nodeDetails.content;
		for(var i=0;i<content.length;i++){
			var inputChunks = this.generateXMLFromStructure( content[i] , block );

			for(var j=0;j<inputChunks.length;j++){
                var inputChunk = inputChunks[j];

                if(inputChunk instanceof Attr) {
					ele.setAttribute(inputChunk.name, inputChunk.value);
                } else if(inputChunk instanceof Element || inputChunk instanceof Text) {
					ele.appendChild(inputChunk);
				} else{
					alert("Don't know node type of " + inputChunk + " yet");
				}
			}
		}
		return [ele];
	} else if(nodeDetails.tagName == "attribute"){
		var attr = this.XMLDoc.createAttribute(nodeDetails.xmlName);
		var attrValue = this.generateXMLFromStructure( nodeDetails.content[0] , block )[0].nodeValue;	//Should we be sending content[0] directly and assuming that the array received is of length 1?
		attr.value = attrValue;
		return [attr];
	} else if(nodeDetails.tagName == "slot"){
		var blocksInSlot = block.getSlotContentsList(nodeDetails.internalName);
		var outputChunks = [];
		for(var i=0;i<blocksInSlot.length;i++){
			var blockStructure = this.blockStructureDict[ blocksInSlot[i].type ];
			for(var j=0;j<blockStructure.length;j++){
				var inputChunks = this.generateXMLFromStructure( blockStructure[j] , blocksInSlot[i] );
				outputChunks.push.apply( outputChunks , inputChunks );
			}
		}
		return outputChunks;
	} else if(nodeDetails.tagName == "optiField"){
		var checkboxValue = block.getFieldValue(nodeDetails.internalName);
        var outputChunks = [];
		if(checkboxValue == "TRUE"){
			var content = nodeDetails.content;
			for(var i=0;i<content.length;i++){
				var inputChunks = this.generateXMLFromStructure( content[i] , block );
				outputChunks.push.apply(outputChunks , inputChunks);
			}
		}
        return outputChunks;
	}
}
