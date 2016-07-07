/* 	This file can be used as follows:
 *
 *	phantomjs testTool.js   <input folder path (optional)>   <result folder path(optional)>
 *
 *	OR
 *
 *	phantomjs testTool.js   <file name (optional)>   <results folder path(optional)>
 *
 *	If input folder path isn't specified, "rng files" folder in the repo is used as default folder for input files
 * 	If output folder path isn't specified, "expected results" folder in the repo is used as default folder to look for expected results
 *
 */
 
 
var fs = require('fs');
var system = require('system');
var webPage = require('webpage');

var passed = 0;
var failed = 0;

var inputFolderName = "rng files";
var resultsDirectory = "expected results";
var failedTestNames = [];
var invalidFiles = 0;

if(system.args.length > 1){					//system.args[0] is the filename itself
	inputFolderName = system.args[1];
	if(system.args.length == 3){
		resultsDirectory = system.args[2];
	}
}

var fileList = fs.list(inputFolderName);

//if the user has entered a file name, fileList's length will be 0
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
}
/*
else{
	//fileList.splice(0,1);	//remove first two entries in the list as they are "." and ".."
}
*/

var page = webPage.create();
page.open("index.html", function(status){
	if(status=="success"){
		console.log("success");
		for(var i=0; i<fileList.length; i++){
			if(fileList[i]=="." || fileList[i]==".."){
				invalidFiles++;
				continue;
			}
			console.log("Input file: "+fileList[i]);
			
			var expectedOutput = getExpectedOutput( fileList[i] );	//get expected output for current file
			
			var inputForParser = getInputForParser( fileList[i] );	//get contents of current rng file
			
			var results = page.evaluate(performPageOperations, inputForParser);	//send input, click interpret, get results
			
			var printedPrettyStatement=false;		//pretty statement here refers to statements like "Didn't find expected blocks or Found unexpected blocks"
			
			for(var j=0; j<expectedOutput.length; j++){
				expectedOutput[j] = expectedOutput[j].trim();
				if(expectedOutput[j]==""){
					continue;
				}
				var index = results.indexOf(expectedOutput[j]);
				if(index == -1){
					if(printedPrettyStatement == false){
						console.log("\nDidn't find the following blocks:\n");
						printedPrettyStatement = true;
					}
					console.log(expectedOutput[j]);
					console.log("\n");
				}else{
					//Array.prototype.splice.apply(results, index, 1);
					results[index] = -1 	//remove matching entries from results			
				}
			}
			
			if(results.length>0){
				printedPrettyStatement = false;
				for(var j=0; j<results.length; j++){
					if(results[j] == -1){
						continue;
					}	
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
		}
		console.log("\nPassed: " + passed + "/" + (fileList.length - invalidFiles));
		console.log("Failed: " + failed + "/" + (fileList.length - invalidFiles));
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
	var results = document.getElementById('results').innerHTML;
	results = results.replace(new RegExp('<p>', 'g'), '');
	results = results.split('</p>');
	results.splice(results.length-1, 1);	//after splitting, the last tag is an empty one, so remove it
	return results;
}


function getExpectedOutput(fileNameWithExtension){
	var fileName = fileNameWithExtension.split(".rng")[0];
	var expectedOutput = fs.read(resultsDirectory + "/" + fileName + ".txt");
	expectedOutput = expectedOutput.split("\n");
	return expectedOutput;
}

function getInputForParser(fileName){
	var input = "";
	if(inputFolderName.indexOf(".rng") == -1){
		input = fs.read(inputFolderName+"/"+fileName);
	}else{
		input = fs.read(inputFolderName);
	}
	return input;
}
