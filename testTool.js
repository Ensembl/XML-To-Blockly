var fs = require('fs');
var system = require('system');
var webPage = require('webpage');

var passed = 0;
var failed = 0;

var inputFolderName = "rng files";
var resultsDirectory = "expected results";
var failedTestNames = [];

if(system.args.length > 1){
	inputFolderName = system.args[1];
	if(system.args.length == 3){
		resultsDirectory = system.args[2];
	}
}

//system.args[0] is the filename itself
var fileList = fs.list(inputFolderName);

if(fileList.length == 0){
	var i=inputFolderName.indexOf(".rng");
	for(; i>=0; i--){
		var c=inputFolderName.charAt(i);
		if(c == "\\" || c=="/"){
			var x = inputFolderName.substring(i+1);
			fileList.push(x);
			break;
		}
	}
}else{
	fileList.splice(0,2);	//remove first two entries in the list as they are "." and ".."
}

var page = webPage.create();
page.open("http://anujk14.github.io/XML-To-Blockly/", function(status){
	if(status=="success"){
		console.log("success");
		for(var i=0; i<fileList.length; i++){
			console.log("Input file: "+fileList[i]);
			var fileName = fileList[i].split(".rng")[0];
			var expectedOutput = fs.read(resultsDirectory+"/"+fileName+".txt");
			expectedOutput = expectedOutput.split("\n");
			var inputForParser = "";
			
			if(inputFolderName.indexOf(".rng") == -1){
				inputForParser = fs.read(inputFolderName+"/"+fileList[i]);
			}else{
				inputForParser = fs.read(inputFolderName);
			}
			var results = page.evaluate(performPageOperations, inputForParser);
			
			results = results.replace(new RegExp('<p>', 'g'), '');
			results = results.split('</p>');
			results.splice(results.length-1, 1);
			
			
			var printedPrettyStatement=false;
			for(var j=0; j<expectedOutput.length; j++){
				expectedOutput[j]=expectedOutput[j].trim();
				if(expectedOutput[j]==""){
					continue;
				}
				
				var index = results.indexOf(expectedOutput[j]);
				if(index == -1){
					if(printedPrettyStatement == false){
						console.log("Didn't find the following blocks:\n");
						printedPrettyStatement = true;
					}
					console.log(expectedOutput[j]);
					console.log("\n");
				}else{
					results.splice(index, 1);
				}
			}
			
			if(results.length>0){
				printedPrettyStatement=false;
				for(var j=0; j<results.length; j++){
					if(printedPrettyStatement == false){
						console.log("Found these unexpected blocks:\n");
						printedPrettyStatement = true;
					}
					console.log(results[j]);
					console.log("\n");
				}
			}
			
			if(printedPrettyStatement == true){
				failedTestNames.push(fileList[i]);
				failed++;
			}else{
				passed++;
			}
			//console.log(expectedOutput);
			//console.log("\n");
			//console.log(results);
		}
		console.log("\nPassed: "+passed+"/"+fileList.length);
		console.log("Failed: "+failed+"/"+fileList.length);
		if(failedTestNames.length>0){
			console.log("\nFailed for the following files:");
			for(var i=0; i<failedTestNames.length; i++){
				console.log(failedTestNames[i]);
			}
		}
		phantom.exit(1);
	}else{
		console.log("Failed to open page");
		phantom.exit(0);
	}
});


function performPageOperations(input){
	document.getElementById('rng_area').value = input;
	var btn = document.getElementById('interpretBtn');
	btn.click();
	//sendEvent('click', btn.offsetLeft, btn.offsetTop, 'left');
	return document.getElementById('results').innerHTML;
}