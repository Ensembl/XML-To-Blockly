/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package testingframework;

/**
 *
 * @author Anuj
 */

import com.google.common.collect.Sets;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.phantomjs.PhantomJSDriver;
import org.openqa.selenium.phantomjs.PhantomJSDriverService;
import org.openqa.selenium.remote.DesiredCapabilities;
import org.openqa.selenium.browserlaunchers.locators.*;


public class TestingFramework {

    /**
     * @param args the command line arguments
     */
    
    public static String[] ListFiles(String dir){
        File directory=new File(dir);
        String[] files=directory.list();
        return files;
    }
    
    public static String readFile(String path) throws FileNotFoundException, IOException{
        File rngFile=new File(path);
        FileReader fileReader=new FileReader(rngFile);
        BufferedReader buffReader=new BufferedReader(fileReader);
        StringBuilder str=new StringBuilder();
        String line=buffReader.readLine();
        while(line!=null){
            str.append(line).append("\n");
            line=buffReader.readLine();
        }
        buffReader.close();
        String ans=str.toString();
        return ans;
    }
    
    
    public static void main(String[] args) throws IOException, InterruptedException {
        // TODO code application logic here
        int passed=0;
        int failed=0;
        
        DesiredCapabilities caps = new DesiredCapabilities();
        caps.setJavascriptEnabled(true);                
        caps.setCapability("takesScreenshot", true);    
        caps.setCapability(
            PhantomJSDriverService.PHANTOMJS_EXECUTABLE_PATH_PROPERTY,
            "phantomjs.exe"
        );
        
        //create PhantomJSDriver and ask it to fetch our website
        WebDriver driver = new PhantomJSDriver(caps);
        driver.get("https://anujk14.github.io/XML-To-Blockly/");
        driver.manage().timeouts().implicitlyWait(10, TimeUnit.SECONDS);
        String fileFolder="rng files";
        String[] fileNames=ListFiles(fileFolder);   //get list of all the files to be tested

        for(int i=0;i<fileNames.length;i++){
            String rngInput=readFile(fileFolder+"/"+fileNames[i]);
            System.out.println("Name: "+fileNames[i]);
            //replace tabs with spaces as Selenium does not send tabs properly
            rngInput=rngInput.replace("\t", " ");
            
            
            
            int extensionIndex=fileNames[i].indexOf(".rng");
            String absoluteFileName=fileNames[i].substring(0,extensionIndex);
            
            String expectedResult=readFile("expected results/"+absoluteFileName+".txt");
            String[] expectedBlocks=expectedResult.split("\n\n");
            
            //last block has an extra \n for some reason. We handle that in the following line
            int numBlocks=expectedBlocks.length;
            String last=expectedBlocks[numBlocks-1];
            last=last.substring(0,last.length()-1);
            expectedBlocks[numBlocks-1]=last;
            
            Set<String> expected=new HashSet(Arrays.asList(expectedBlocks));
            System.out.println("Expected number of blocks: "+expectedBlocks.length);
            
            //make the driver send the input data to textArea and click interpret and fetch results
            driver.findElement(By.id("rng_area")).sendKeys(rngInput);
            driver.findElement(By.id("interpretBtn")).click();
            String results=driver.findElement(By.id("results")).getText();
            driver.findElement(By.id("rng_area")).clear();
            
            String[] actualBlocks=results.split("\n");
            Set<String> actual=new HashSet(Arrays.asList(actualBlocks));
            System.out.println("Actual number of blocks: "+actualBlocks.length);
            
            /*
            for(int j=0;j<expectedBlocks.length;j++){
                System.out.println(expectedBlocks[j]);
                System.out.println(actualBlocks[j]);
            }
            */        
            
            //compare sets of expected and actual values and accordingly print test result
            if(expected.equals(actual)){
                System.out.println("Passed test");
                passed++;
            }else{
                Set<String> diffExpected=new HashSet<String>();
                Sets.difference(expected, actual).copyInto(diffExpected);
                System.out.println("Didn't find these in the actual answer: ");
                for(String str:diffExpected){
                    System.out.println(str);
                }
                
                Set<String> diffActual=new HashSet<String>();
                Sets.difference(actual, expected).copyInto(diffActual);
                System.out.println("Found these unexpeted blocks in actual implementation: ");
                for(String str:diffActual){
                    System.out.println(str);
                }
                failed++;
            }
            
        }
        System.out.println("Test summary:");
        System.out.println("Passed: "+passed+"/"+fileNames.length);
        System.out.println("Failed: "+failed+"/"+fileNames.length);
        driver.close();
    }
    
}
