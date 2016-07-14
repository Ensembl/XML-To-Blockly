/* 	This file can be used as follows:
 *
 *	phantomjs testTool.js   <input folder path (optional)>   <result folder path(optional)>
 *
 *	OR
 *
 *	phantomjs testTool.js   <file name (optional)>   <results folder path(optional)>
 *
 *	If input folder path isn't specified, "examples" folder in the repo is used as default folder for input files
 * 	If output folder path isn't specified, "output_examples" folder in the repo is used as default folder to look for expected results
 *
 */
 
 
var fs = require('fs');
var system = require('system');
var webPage = require('webpage');

var passed = 0;
var failed = 0;
var skipped = 0;

var inputFolderName = "examples";
var resultsDirectory = "output_examples";
var failedTestNames = [];

var fileList;

if(system.args.length > 1){					//system.args[0] is the filename itself

      // system.args[1] is the file / directory to test
      if (fs.isDirectory(system.args[1])) {
	    inputFolderName = system.args[1];
	    fileList = getDirectoryListing(system.args[1]);

      } else if (fs.isFile(system.args[1])) {
	    var x = splitFileName(system.args[1]);
	    inputFolderName = x[0];
	    fileList = [x[1]];

      } else if (fs.isFile(inputFolderName + fs.separator + system.args[1])) {
	    fileList = [system.args[1]];

      }

	if(system.args.length == 3){
		resultsDirectory = system.args[2];
	}

} else {
      fileList = getDirectoryListing(inputFolderName);	  // default location
}

var page = webPage.create();
page.open("index.html", function(status){
	if(status=="success"){
		console.log("success");
		for(var i=0; i<fileList.length; i++){
			console.log("Input file: "+fileList[i]);
			if (!checkIfExpectedOutput(fileList[i])) {
			      console.log("No expected output, skipping");
			      skipped++;
			      continue;
			}
			
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
				console.log("passed");
			}
		}
		console.log("\nPassed: " + passed + "/" + fileList.length);
		console.log("Failed: " + failed + "/" + fileList.length);
		console.log("Skipped: " + skipped + "/" + fileList.length);
		if(failedTestNames.length>0){
			console.log("\nFailed for the following files:");
			for(var i=0; i<failedTestNames.length; i++){
				console.log(failedTestNames[i]);
			}
		}
		phantom.exit(failed ? 1 : 0);
	}else{
		console.log("Failed to open page");
		phantom.exit(1);
	}
});

function performPageOperations(input){
	document.getElementById('rng_area').value = input;
	var btn = document.getElementById('interpretBtn');
	btn.click();
	var results = document.getElementById('results').innerHTML;
	results = results.replace(new RegExp('<pre>', 'g'), '');
	results = results.split('</pre>');
	results.splice(results.length-1, 1);	//after splitting, the last tag is an empty one, so remove it
	return results;
}


function checkIfExpectedOutput(fileNameWithExtension){
	var fileName = fileNameWithExtension.split(".rng")[0];
	return fs.isReadable(resultsDirectory + fs.separator + fileName + ".txt");
}

function getExpectedOutput(fileNameWithExtension){
	var fileName = fileNameWithExtension.split(".rng")[0];
	var expectedOutput = fs.read(resultsDirectory + fs.separator + fileName + ".txt");
	expectedOutput = expectedOutput.split(/\n{2,}/);
	return expectedOutput;
}

function getInputForParser(fileName){
      return fs.read(inputFolderName+fs.separator+fileName);
}

function getDirectoryListing(dirName) {
      var tmpFileList = fs.list(dirName);
      var fileList = [];
      for(var i=0; i<tmpFileList.length; i++){
	    var fileName = inputFolderName + fs.separator + tmpFileList[i];
	    if (fs.isFile(fileName)) {
		  fileList.push(tmpFileList[i]);
	    }
      }
      return fileList;
}

function splitFileName(fileName) {
      var i = fileName.indexOf(".rng");
      for(; i>=0; i--){
	    var c = fileName.charAt(i);
	    if (c == fs.separator){
		  return [fileName.substring(0,i), fileName.substring(i+1)];
	    }
      }
      // If we arrive here it means that fileName does not contain any
      // directory separator, so it is in the current directory
      return [ '.', fileName];
}

