import { ImageAnnotatorClient } from '@google-cloud/vision';
import { readFile, readFileSync, writeFile } from 'fs';
import { createWorker } from 'tesseract.js';

function isTabularDataLine(line) {
    // Check if the line starts with a number
    return /^\d+/.test(line.trim());
}



async function detectTextFromImageUsingTesseract(req, res) {
    try {
        const worker = await createWorker();
        await worker?.loadLanguage('eng');
        await worker?.initialize('eng');
        const { data: { text } } = await worker?.recognize('./img/service-invoice-template-2x.jpg');
        // console.log('text\n', text);
        let textArray = text.split('\n');
        // console.log('textArray\n', textArray);

        const invoiceInfo = {};
        textArray.forEach((text, index) => {
            if (text.includes('Invoice Date')) {
                // console.log('pop',textArray[index].substring(textArray[index].indexOf('Invoice Date'), textArray[index].length - 1).split('Invoice Date'))
                invoiceInfo['invoice_date'] = textArray[index].split(':')[1].trim();
                // console.log('i', index)
                // console.log('j', textArray[index].length)
            }
            if(text.includes('Due Date')) {
                invoiceInfo['due_date'] = textArray[index].split(':')[1].trim();
            }
            if(text.includes('Bill To')) {
                invoiceInfo['customer_name'] = textArray[index+1].trim();
            }
            
        });

        // const tableData = textArray.filter((text) => {
        //     return text.includes('Total') || text.includes('Subtotal') || text.includes('Tax') || text.includes('Balance Due')
        // })

        
        // Find the start of the tabular data (where the line contains '# Item & Description Qty Rate Amount')
        const tabularData = [];
        const startIndex = textArray.findIndex((line) =>
            line.includes('# Item & Description Qty Rate Amount')
        );
        
        const tabularMatch = /^(\d+)\s(.+?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)$/
        // const tabularMatch = /^(\d+)\s+([\s\S]+?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)$/
        // const tabularMatch = /^(\d+)\s+([^\d].+?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)$/;
        //   if (startIndex === -1) {
            //     return tabularData; // Tabular data not found, return empty array
            //   }
            
            // Iterate over the textArray from the start index to extract the tabular data
    if(startIndex !== -1) {
        for (let i = startIndex + 1; i < textArray.length; i++) {
            // console.log('i', i)
            const line = textArray[i];
            console.log(textArray[i])
            // console.log('line\n', line)
            // Check if the line contains tabular data (item number, description, qty, rate, and amount)
            // console.log('line\n', line.match(/^(\d+)\s(.+?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)$/))
            // console.log('---------')
            // const tabularLineMatch = line.match(/^(\d+)\s(.+?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)$/);
            // const otherFields = line.trim().split(/^(\d+)\s(.+?)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)$/);
            // console.log(otherFields, otherFields.length)
            const tabularLineMatch = line.match(tabularMatch);
            // console.log(tabularLineMatch)
            if(tabularLineMatch){
                // console.log('tabularLineMatch\n', tabularLineMatch)
            // console.log('123')
            // Split the tabular data line into individual columns
            const [, itemNumber, itemDescription, quantity, rate, amount] = tabularLineMatch;
            // line.trim().split(/\s+/);

            // Create an object representing the tabular data row
            const rowData = {
                itemNumber,
                itemDescription,
                quantity,
                rate,
                amount,
            };

            // Add the object to the tabularData array
            tabularData.push(rowData);
            }
            
        }
        invoiceInfo['products'] = tabularData;
    } else {
        invoiceInfo['products'] = [];
    }


    await worker.terminate();
    console.log(invoiceInfo);
        // writeFile('invoice_info_tesseract.txt', text, (err) => {
        //     if (err) {
        //         console.error(err);
        //     } else {
        //         console.log('Invoice information stored successfully');
        //     }
        // });
        return res.status(200).json(
            invoiceInfo
        )
    } catch (error) {
        console.error(error);
        return res.status(500).json(
            error.toString()
        )
    }
}



async function detectTextFromImageUsingVision(req, res) {
    try {
        const imagePath = './img/service-invoice-template-2x.jpg';
        // Instantiates a client
        const client = new ImageAnnotatorClient({
            // keyFilename: './private/anchorbooks-ocr-22132c92e2d5.json'
            keyFilename: './'
        });

        // const request = {
        //     image: {
        //       source: {
        //         uri: imagePath,
        //       },
        //     },
        //     features: [
        //       {
        //         type: 'TEXT_DETECTION',
        //       },
        //     ],
        //   };
          
        //   await client.textDetection(request, (err, response) => {
        //     if (err) {
        //       console.error(err);
        //     } else {
        //         console.log('res\n', response, '\nres')
        //       const textAnnotations = response.textAnnotations;
        //         console.log('textAnnotations\n',textAnnotations)
        //       const invoiceInfo = {};
          
        //       for (const textAnnotation of textAnnotations) {
        //         const boundingBox = textAnnotation.boundingBoxes[0];
        //         const text = textAnnotation.description;
          
        //         invoiceInfo[text] = boundingBox;
        //       }
          
        //       writeFile('invoice_info.json', JSON.stringify(invoiceInfo), (err) => {
        //         if (err) {
        //           console.error(err);
        //         } else {
        //           console.log('Invoice information stored successfully');
        //         }
        //       });
        //     }
        //   });

        //   return res.status(200).json(
        //     'ocr'
        //   )

        // client.labelDetection(imagePath).then((res) => {
        //     console.log(res)
        //     const labels = res[0].labelAnnotations;

        // }).catch((err) => {
        //     console.error(err)
        // })


        // const [result] = await client.textDetection(imagePath).then((res) => {
        //     console.log(res)
        //     const labels = res[0].textAnnotations;
        //     console.log('textAnnotations\n', labels)
        //     console.log('fullPageText\n', res[0].fullTextAnnotation.text)
        //     // console.log('fullPage\n', res[0].fullTextAnnotation.pages)
        //      // Read the image file
        //     const imageFile = readFile(imagePath);

        //     // Convert the image file to base64 encoded string
        //     const encodedImage = imageFile.toString('base64');

        //     image: { content: encodedImage }
        // }).catch((err) => {
        //     console.error(err)
        // })

        // const detections = result.textAnnotations;
        // const extractedText = detections[0].description; // The first annotation contains the entire detected text
        // console.log('-------------ExtractedText--------------')
        // console.log(extractedText)

        // return res.status(200).json(
        //     extractedText.toString()
        // )
        // Read the image file
        const imageFile =  readFileSync(imagePath);
    
        // Convert the image file to base64 encoded string
        const encodedImage = imageFile?.toString('base64');
    
        // Make a request to the Vision API to detect text
        const [result] = await client?.textDetection({
            image: { content: encodedImage },
        });
    
        // Extract the text from the response
        // console.log({result});

        const invoiceInfo = {};
        // console.log(result.textAnnotations[0].description)
        console.log(result.textAnnotations[0].boundingPoly.vertices)
          
        // for (const textAnnotation of result.textAnnotations) {
            // console.log(textAnnotation?.description)

            // const boundingBox = textAnnotation.description;
            // console.log({boundingBox})
            // const boundingBox = textAnnotation.boundingBoxes[0];
            // const text = textAnnotation.description;
          
            // invoiceInfo[text] = boundingBox;
        // }

        // writeFile('invoice_info.txt', result.textAnnotations[0].boundingPoly.vertices.toString(), (err) => {
        //     if (err) {
        //         console.error(err);
        //     } else {
        //         console.log('Invoice information stored successfully');
        //     }
        // });
        // console.log({invoiceInfo})

        // const detections = result.textAnnotations;
        // const extractedText = detections[0].description; // The first annotation contains the entire detected text
        // console.log('-------------ExtractedText--------------')
        // console.log(extractedText)
        
        // console.log(extractedText)
        return res.status(200).json(
            // extractedText.toString()
            'ocr'
        )
    } catch (error) {
        console.error(error);
        return res.status(500).json(
            error.toString()
        )
    }
}

// detectTextFromImage().then((res) => {
//     console.log(res.bold)
// }).catch((err) => {
//     console.error(err.red.bold)
// })



const main = async (req, res) => {
    res.status(200).json(
        'hello world'
    )
}

export {
    main,
    // detectTextFromImageUsingVision
    detectTextFromImageUsingTesseract
}