import { ImageAnnotatorClient } from '@google-cloud/vision';
import { readFile, readFileSync, writeFile } from 'fs';
import { createWorker } from 'tesseract.js';

async function detectTextFromImageUsingTesseract(req, res) {
    try {
        const worker = await createWorker();
        await worker?.loadLanguage('eng');
        await worker?.initialize('eng');
        const { data: { text } } = await worker?.recognize('./img/invoice-1.png');
        let textArray = text.split('\n');
        // writeFile('invoice2_info_tesseract.txt', text, (err) => {
        //     if (err) {
        //         console.error(err);
        //     } else {
        //         console.log('Invoice information stored successfully');
        //     }
        // });
        // console.log('textArray\n', textArray);

        const invoiceInfo = {};
        const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
        const currencyPattern = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g;

        textArray.forEach((text, index) => {
            if (
                text.toLowerCase().includes('invoice date') || 
                text.toLowerCase().includes('date issued')
                ) {
                invoiceInfo['invoice_date'] = textArray[index].includes(':') ?
                textArray[index]?.split(':')[1]?.trim() : 
                textArray[index + 1]?.trim().match(datePattern)[1] + '/' + textArray[index + 1]?.trim().match(datePattern)[2] + '/' + textArray[index + 1]?.trim().match(datePattern)[3]
            }
            if(text.toLowerCase().includes('due date')) {
                invoiceInfo['due_date'] = textArray[index].includes(':') ? textArray[index]?.split(':')[1]?.trim() : 
                textArray[index + 1]?.trim().match(datePattern)[1] + '/' + textArray[index + 1]?.trim().match(datePattern)[2] + '/' + textArray[index + 1]?.trim().match(datePattern)[3]
            }
            if(
                text.toLowerCase().includes('bill to') || 
                text.toLowerCase().includes('billed to')
            ) {
                invoiceInfo['customer_name'] = textArray[index + 1].trim().split(' ')[0] + ' ' + textArray[index + 1].trim().split(' ')[1];
            }
            if(
                text.toLowerCase().includes('sub total') ||
                text.toLowerCase().includes('subtotal')
            ) {
                invoiceInfo['sub_total'] = text.toLowerCase().includes('sub total') ? 
                textArray[index].toLowerCase().trim().split('sub total')[1] : 
                textArray[index].toLowerCase().trim().split('subtotal')[1];
            }
            if(text.toLowerCase().includes('total')) {
                invoiceInfo['total'] = textArray[index].toLowerCase().trim().split('total ')[1];
            }
            if(
                text.toLowerCase().includes('balance due') || 
                text.toLowerCase().includes('amount due')
            ) {
                invoiceInfo['balance_due'] = text.toLowerCase().includes('balance due') ? 
                textArray[index].toLowerCase().trim().split('balance due ')[1] :
                textArray[index + 1].match(currencyPattern)[0]
            }
        
        });
        
        // Find the start of the tabular data (where the line contains '# Item & Description Qty Rate Amount')
        const tabularData = [];
        const startIndex = textArray.findIndex((line) =>
            line.toLowerCase().includes('# item & description qty rate amount') || line.toLowerCase().includes('rate amount') || line.toLowerCase().includes('description')
        );
            
        if(startIndex !== -1) {
            for (let i = startIndex + 1; i < textArray.length; i++) {
                const line = textArray[i];
                const itemArray = line?.trim()?.split(' ');
                let itemDesc = '';
                if(
                    parseInt(itemArray[0]) && 
                    parseInt(itemArray[itemArray.length - 1]) &&
                    parseInt(itemArray[2]) &&
                    itemArray.length >= 5
                ) { 
                    itemDesc = itemArray[1];
                } else if(
                    // parseInt(itemArray[0]) && 
                    // parseInt(itemArray[itemArray.length - 1]) &&
                    isNaN(parseInt(itemArray[0])) &&
                    (!isNaN(parseInt(itemArray[itemArray.length - 1])) ||
                    !isNaN(parseInt(itemArray[itemArray.length - 2]))) &&
                    // parseInt(itemArray[2]) &&
                    itemArray.length >= 4
                ){
                    itemDesc = itemArray[0];
                }
                else {
                    // items if item description is more than one word
                    itemArray.forEach((item) => {
                        if(isNaN(parseInt(item))){
                            itemDesc += item + ' ';
                        }
                    })
                }
                
                if(
                    !isNaN(parseInt(itemArray[0])) &&
                    (!isNaN(parseInt(itemArray[itemArray.length - 3])) ||
                    !isNaN(parseInt(itemArray[itemArray.length - 4]))) &&
                    // !isNaN(parseInt(itemArray[itemArray.length - 2])) &&
                    // !isNaN(parseInt(itemArray[itemArray.length - 1])) &&
                    itemDesc.length > 0
                ){
                    const rowData = {
                        itemNumber: !isNaN(parseInt(itemArray[0])) ? itemArray[0] : null,
                        itemDescription: itemDesc,
                        quantity: !isNaN(parseFloat(itemArray[itemArray.length - 3])) ? itemArray[itemArray.length - 3] : itemArray[itemArray.length - 4],
                        rate: !isNaN(parseFloat(itemArray[itemArray.length - 2])) ? itemArray[itemArray.length - 2] : itemArray[itemArray.length - 3],
                        amount: itemArray[itemArray.length - 1],
                    }
                    tabularData.push(rowData);
                } else if (
                    isNaN(parseInt(itemArray[0])) &&
                    (!isNaN(parseInt(itemArray[itemArray.length - 2])) ||
                    !isNaN(parseInt(itemArray[itemArray.length - 3]))) &&
                    // !isNaN(parseInt(itemArray[itemArray.length - 2])) &&
                    // !isNaN(parseInt(itemArray[itemArray.length - 1])) &&
                    itemDesc.length > 0
                ) {
                    const rowData = {
                        itemDescription: itemDesc,
                        rate: itemArray[itemArray.length - 3],
                        quantity: !isNaN(parseFloat(itemArray[itemArray.length - 2])) ? itemArray[itemArray.length - 2] : itemArray[itemArray.length - 3],
                        amount: itemArray[itemArray.length - 1],
                    }
                    tabularData.push(rowData);
                }
                
            }
            invoiceInfo['products'] = tabularData;
        } else {
            invoiceInfo['products'] = [];
        }
        await worker.terminate();
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
        const imagePath = './img/invoice-1.jpg';
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

        writeFile('invoice_info_anchor.txt', result.textAnnotations[0].boundingPoly.vertices.toString(), (err) => {
            if (err) {
                console.error(err);
            } else {
                console.log('Invoice information stored successfully');
            }
        });
        console.log({invoiceInfo})

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



const main = async (req, res) => {
    res.status(200).json(
        'hello world'
    )
}

export {
    main,
    // detectTextFromImageUsingVision,
    detectTextFromImageUsingTesseract
}