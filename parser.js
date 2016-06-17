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


var xmlParser=new DOMParser();
var xmlDoc;
var elements=[];
var blocks=[];
var blockNames=[];
var oneOrMoreBlocks=[];
var optionalNames=[];
		
//init function for initializing the Blockly block area
function init(){
	var x=Blockly.inject('blocklyDiv', {
		toolbox: document.getElementById('startBlocks'),
        collapse: true
	});
}
		
//reads the file
function readFile(evt){
	var file=evt.target.files[0];
	var reader=new FileReader();
	reader.readAsText(file);
	reader.onload=function(e){
		console.log(e.target.result);
		xmlDoc=xmlParser.parseFromString(e.target.result,"text/xml");
		handleXML();
	}
}
		
//handles xml by creating blocks as per RNG rules
function handleXML(){
	var root=xmlDoc.documentElement;
	var a;
	
	removeRedundantText(root);
		
	//get all the define blocks in the document and create blocks for them one by one.
	var defineNodes=xmlDoc.getElementsByTagName("define");
	for(var i=0;i<defineNodes.length;i++){
		//fixed color - 295 for define blocks for now.
		createBlocks(defineNodes[i],defineNodes[i].getAttribute("name"), 295);
	}
		
	root=xmlDoc.getElementsByTagName("start")[0];

	var colour=0;
	createBlocks(root,"start",colour);
	
	var script=document.createElement('script');
	script.type="text/javascript";
	for(var i=0;i<blocks.length;i++){
		var resultsData=document.getElementById("results");
		resultsData.innerHTML=resultsData.innerHTML+"<p>"+blocks[i]+"</p>"
		script.text+=blocks[i];
			
		var blocklyXml=document.getElementById('startBlocks');
		console.log(blockNames[i]);
		blocklyXml.innerHTML=blocklyXml.innerHTML+"<block type='"+blockNames[i]+"'></block>";
	}
	document.getElementsByTagName("head")[0].appendChild(script);
			
	init();
}
		
//Removes #text nodes
//These are string elements present in the XML document between tags. The
//RNG specification only allows these strings to be composed of whitespace.
//They don't carry any information and can be removed
function removeRedundantText(node){
	var children=node.childNodes;
	for(var i=0;i<children.length;i++){
		if(children[i].nodeName=="#text"){
			//console.log("found text");
			children[i].parentNode.removeChild(children[i]);
			i--;
			continue;
		}else{
			removeRedundantText(children[i]);
		}
	}
}
		
//The name for every child block is sent to it by its parent. The child does not need to find its place in the hierarchy. The parent node does it for all of its children and sends them their name while calling them.
function createBlocks(node, name, colour){
	var children=node.childNodes;
	var blockData="";	//Contains data sent by all the children merged together one after the other.
	var childData=[];	//Keeps track of block data sent by children.
	var childNames=[];	//Keeps track of children block names
			
	for(var i=0;i<children.length;i++){
		if(children[i].nodeName=="text"){
			if(children.length==1){
				continue;
			}
		}
		
		if(children[i].nodeName=="data"){
			continue;
		}
		
		if(children[i].nodeName=="#comment"){
			continue;
		}

		var nameAttr=children[i].getAttribute("name");
		
		if(nameAttr==null){
			nameAttr=children[i].nodeName;
		}
		
		nameAttr=nameAttr.substring(0,3);	
				
		//The name for the child is given as <parent name/hierarchy>+<first 3 characters of the child element>+<index of the child as per its parent block>.
		var nameForChild=name+":"+nameAttr+i;
				
		var dataReceivedFromChild=createBlocks(children[i], nameForChild, colour+45);
		blockData+=dataReceivedFromChild;
		childData.push(dataReceivedFromChild);
		childNames.push("block_"+nameForChild);
	}
			
	var nodeType=node.nodeName;
	
	/*
	//could be used to handle datatypes efficiently. But causes multiple element siblings to behave as inline inputs
	
	if(nodeType=="text"){
		var data="this.appendDummyInput().appendField(new Blockly.FieldTextInput(''),'"+name+"');this.setInputsInline(true);";
		return data;
	}
			
	else if(nodeType=="element" || nodeType=="attribute"){
		var data="this.appendDummyInput().appendField('"+name+"');";
		blockData=data+blockData;
	}
	*/
		
		
	if(nodeType=="element"){
		if(children.length==1 && children[0].nodeName=="text"){
			//data contains data that the current tag will generate.
			var data="this.appendDummyInput().appendField('"+name+"').appendField(new Blockly.FieldTextInput(''),'"+name+"');";
			blockData=data+blockData;
		}else{
			var data="this.appendDummyInput().appendField('"+name+"');";
			blockData=data+blockData;
		}
	}
	
	
	//attributes do not check the level below them as there is no functionality currently to handle datatypes and parameters. At the attribute node, a dummy input which has a label and an input field is generated. 
	else if(nodeType=="attribute"){
		var data="this.appendDummyInput().appendField('"+name+"').appendField(new Blockly.FieldTextInput(''),'"+name+"');";
		return data;
	}
			
			
	else if(nodeType=="start"){
		var blockName="block_"+name;
		var finalBlock="Blockly.Blocks['"+blockName+"']={init:function(){this.appendDummyInput().appendField('"+name+"');"+blockData+"this.setColour("+colour+");}};";
		blocks.push(finalBlock);
		blockNames.push(blockName);
		return;
	}
	
	
			
	else if(nodeType=="interleave"){
		var childNamesInFormat="'"+childNames.join("','")+"'";
	
		//Every interleave child has sent in its data. This loop just creates blocks for each child of the interleave tag.
		for(var i=0;i<childData.length;i++){
			var blockName=childNames[i];
			
			var finalBlock="Blockly.Blocks['"+blockName+"']={init:function(){"+childData[i]+"this.setPreviousStatement(true,["+childNamesInFormat+"]);this.setNextStatement(true,["+childNamesInFormat+"]);this.setColour("+colour+");}};";
			blocks.push(finalBlock);
			blockNames.push(blockName);
		}
		
		//This appends to the block which contains the interleave tag and creates a notch there.
		blockData="this.appendStatementInput('"+name+"').setCheck(["+childNamesInFormat+"]).appendField('"+name+"');";
	}
	
	
	
	//for choice nodes, we ensure that only one option is selected by keeping no option for setNextStatement for its children.
	else if(nodeType=="choice"){
		var childNamesInFormat="'"+childNames.join("','")+"'";
		//Every choice child has sent in its data. This loop just creates blocks for each child of the oneOrMore tag.
		for(var i=0;i<childData.length;i++){
			var blockName=childNames[i];
			
			var finalBlock="Blockly.Blocks['"+blockName+"']={init:function(){"+childData[i]+"this.setPreviousStatement(true,['"+name+"','"+blockName+"']);this.setColour("+colour+");}};";
			blocks.push(finalBlock);
			blockNames.push(blockName);
		}
				
		//This appends to the block which contains the choice tag and creates a notch there.
		blockData="this.appendStatementInput('"+name+"').setCheck(["+childNamesInFormat+",'"+name+"']).appendField('"+name+"');";
	}
	
	//zeroOrMore and oneOrMore have almost the same structure. oneOrMore just keeps track of IDs for validation while saving.
	//get data from all children. Create a block for them. Send appendStatementInput to parent.
	else if(nodeType=="oneOrMore" || nodeType=="zeroOrMore"){
		//instead of keeping just block_+name as the block name, :child has been added to the name to handle cases where the parent oneOrMore node is also supposed to be in the form of a block. eg. <choice><oneOrMore></oneOrMore>.....</choice>
		var blockName="block_"+name+":child";
		var finalBlock="Blockly.Blocks['"+blockName+"']={init:function(){"+blockData+"this.setPreviousStatement(true,['"+blockName+"','"+name+"']);this.setNextStatement(true,['"+blockName+"']);this.setColour("+colour+");}};";
		
		var data;
		if(nodeType=="oneOrMore"){
			data="this.appendStatementInput('"+name+"').setCheck(['"+blockName+"']).appendField('"+name+"');oneOrMoreBlocks.push(this.id);";
		}else{
			data="this.appendStatementInput('"+name+"').setCheck(['"+blockName+"']).appendField('"+name+"');";
		}
		blocks.push(finalBlock);
		blockNames.push(blockName);
		return data;
	}
	
	//add whatever we get from children nodes to the optional node and return that.
	else if(nodeType=="optional"){
		var childFields=[];
		for(var i=0;i<childNames.length;i++){
			var fieldName=childNames[i].split("block_");
			fieldName=fieldName[1];
			childFields.push(fieldName.toString());
		}
		optionalNames=[];
		//optionalNames="'"+childFields.join("','")+"'";
		optionalNames=childFields;
		//var	data="this.appendDummyInput('"+name+"').appendField(new Blockly.FieldCheckbox(\"TRUE\", checker(["+childNamesInFormat+"])), '"+name+"_checkbox').appendField('"+name+"');";
		var	data="this.appendDummyInput('"+name+"').appendField(new Blockly.FieldCheckbox(\"TRUE\", checker), '"+name+"_checkbox').appendField('"+name+"');";
		blockData=data+blockData;
		//blocks.push(finalBlock);
		//blockNames.push(blockName);
		//return data;
	}
			
			
	//creates define blocks. The define block that is created inly has a notch above and never below. It is the ref code which changes according to whether or not the ref code is in a choice or oneOrMore block.
	else if(nodeType=="define"){
		var blockName="block_"+name;
		var finalBlock="Blockly.Blocks['"+blockName+"']={init:function(){this.appendDummyInput().appendField('"+name+"');this.setColour("+colour+");"+blockData+"this.setPreviousStatement(true);}};";
		blocks.push(finalBlock);
		blockNames.push(blockName);
		return;
	}
	
	
	//the ref block will have a notch above or below or both according to its parent element. The notch is added to it according to the code written to handle choice and oneOrMore elements.
	else if(nodeType=="ref"){
		var correspondingDefineName=node.getAttribute("name");
		var data="this.appendStatementInput('"+name+"').appendField('"+name+"').setCheck('block_"+correspondingDefineName+"');";
		return data;
	}
	
	else if(nodeType=="text"){
		var data="this.appendDummyInput().appendField('"+name+"').appendField(new Blockly.FieldTextInput(''),'"+name+"');";
		return data;
	}
	
	//returns block data to the parent node that had called it
	return blockData;
}
		
//Adds an event listener for detecting whether the user has provided a file as input or not.
document.getElementById("file").addEventListener('change',readFile);


//this commented part contains a few things that were tried out(not necessarily together) to validate oneOrMore but it didn't work properly. Kept now in case some idea from here is required in future.
/*
function validate(){
	var workspace=Blockly.getMainWorkspace();
	for(var i=0;i<oneOrMoreBlocks.length;i++){
		var currentBlock=Blockly.Block.getById(oneOrMoreBlocks[i],workspace);
		
		if(currentBlock==null){
			console.log("null for id: "+oneOrMoreBlocks[i]);
			continue;
		}
		
		var numChildren=currentBlock.childBlocks_.length;
		if(numChildren==0){
			alert("Block "+currentBlock.type+" needs to have at least one child");
		}else{
			console.log(currentBlock);
		}
		
		
		var c=currentBlock.getDescendants();
		console.log(currentBlock.type+" "+c.length);
	}
	
}*/

//function to check if all the oneOrMore blocks have children attached to them.
function validate(){
	var workspace=Blockly.getMainWorkspace();
	var allClear=true;
	for(var i=0;i<oneOrMoreBlocks.length;i++){
		var currentBlock=Blockly.Block.getById(oneOrMoreBlocks[i],workspace);
		var foundChild=false;
		var connections=[];
		var children=[];
		var childBlockNames=[];	//contains all the allowed child block names
		
		if(currentBlock==null){
			continue;
		}else{
			//get all children of the current oneOrMore block being tested
			children=currentBlock.getChildren();
			//get all connection types of the current block
			connections=currentBlock.getConnections_();
			
			//last index of the array indicates the types of allowed connections for children blocks.
			var childConn=connections[connections.length-1];
			console.log(childConn);
			//childConn contains a field check_ which is an array of the valid block types that can be the children of current block. We add these names to childBlockNames
			var typesOfChildren=childConn.check_;
			console.log(typesOfChildren);
			for (var j=0;j<typesOfChildren.length;j++){
				childBlockNames.push(typesOfChildren[j]);
			}
			
			//now we parse through all the children of the current block being tested to check if it actually has a nested child element and not just a nextStatement. foundChild keeps track of whether currentBlock has at least one nested child attached to it.
			for(var j=0;j<children.length;j++){
				var currentChildBeingEvaluated=children[j].type;
				if(childBlockNames.indexOf(currentChildBeingEvaluated)!=-1){
					foundChild=true;
				}
			}
			if(foundChild==false){
				alert(currentBlock.type+" needs to have at least one child");
				allClear=false;
			}
		}
	}
	if(allClear==true){
		alert("You may save this!");
	}
}

function checker(){
	//alert("in");
	var source=this.sourceBlock_;
	console.log(optionalNames.length);
	//get the name of the checkbox' dummyInput 
	var checkBoxFieldName=this.name.split("_checkbox")[0];
	
	var it;
	var iplist=source.inputList;
	//find out at which position of the inputList of source block, the checkbox is present.
	for(var it=0;it<iplist.length;it++){
		if(iplist[it].name==checkBoxFieldName){
			break;
		}
	}
	console.log("checkbox field is at position "+it+" in iplist");
	//now it contains the index from where we have to set values as invisible
	
	if(this.state_==false){
		for(var i=it+1;i<=(it+optionalNames.length);i++){
			iplist[i].setVisible(true);
		}
		//console.log(source.inputList);
		return;
	}else if(this.state_==true){
		for(var i=it+1;i<=(it+optionalNames.length);i++){
			console.log(iplist[i]);
			iplist[i].setVisible(false);
		}
		return;
		//console.log(source.inputList);
	}	
}