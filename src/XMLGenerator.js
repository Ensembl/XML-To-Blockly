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


/* Entry point for generating XML.
 */
function XMLGenerator(blockStructureDict , blocklyWorkspace){
	this.blockStructureDict = blockStructureDict;
	this.XMLDoc = document.implementation.createDocument( '', '' , null );
	var startBlock= blocklyWorkspace.getTopBlocks()[0];
	var startBlockStructure = this.blockStructureDict[startBlock.type];

    var outputChunks = [];
	for(var i=0;i<startBlockStructure.length;i++){
		var inputChunks = this.generateXMLFromStructure( startBlockStructure[i] , startBlock );
        outputChunks.push.apply( outputChunks , inputChunks );
	}

    if(outputChunks.length == 1) {  // expected number of top-level elements generated is 1
        var topLevelChunk = outputChunks[0];
        if(topLevelChunk instanceof Element) {
            this.XMLDoc.appendChild( topLevelChunk );
        } else {
            this.errorText = "Attempting to add a non-Element (Attr? Text?) as the top node. Per XML standard we do not support this."
        }
    } else if(outputChunks.length == 0) {
        this.errorText = "Empty XML has been generated";
    } else {
        this.errorText = "Attempting to create "+outputChunks.length+" top elements. Per XML standard we only support one."
    }
}


// Recursive function to generate XML
XMLGenerator.prototype.generateXMLFromStructure = function( nodeDetails , block ){
    var outputChunks = [];

	if(nodeDetails.tagName == "text"){
		var textNode = this.XMLDoc.createTextNode( block.getFieldValue(nodeDetails.internalName) );
        outputChunks.push( textNode );

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
        outputChunks.push( ele );

	} else if(nodeDetails.tagName == "attribute"){
		var attr = this.XMLDoc.createAttribute(nodeDetails.xmlName);
		var attrValue = this.generateXMLFromStructure( nodeDetails.content[0] , block )[0].nodeValue;	//Should we be sending content[0] directly and assuming that the array received is of length 1?
		attr.value = attrValue;
        outputChunks.push( attr );

	} else if(nodeDetails.tagName == "slot"){
		var childBlocksInSlot = block.getSlotContentsList(nodeDetails.internalName);
		for(var i=0;i<childBlocksInSlot.length;i++){
			var childBlockStructure = this.blockStructureDict[ childBlocksInSlot[i].type ];
			for(var j=0;j<childBlockStructure.length;j++){
				var inputChunks = this.generateXMLFromStructure( childBlockStructure[j] , childBlocksInSlot[i] );
				outputChunks.push.apply( outputChunks , inputChunks );
			}
		}

	} else if(   (nodeDetails.tagName == "collapsible")
             || ((nodeDetails.tagName == "optiField") && (block.getFieldValue(nodeDetails.internalName) == "TRUE"))
             ){
        var content = nodeDetails.content;
        for(var i=0;i<content.length;i++){
            var inputChunks = this.generateXMLFromStructure( content[i] , block );
            outputChunks.push.apply(outputChunks , inputChunks);
        }
	}

    return outputChunks;
}
