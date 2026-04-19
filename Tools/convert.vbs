Option Explicit

Dim objExcel, objWorkbook, objSheet
Dim objFSO, objFileEN, objFileVI, objFileJP
Dim dictEN, dictVI, dictJP
Dim row, lastRow
Dim key, valEN, valVI, valJP
Dim jsonEN, jsonVI, jsonJP

Set objExcel = CreateObject("Excel.Application")
Set objWorkbook = objExcel.Workbooks.Open(WScript.Arguments(0)) ' Excel file path as arg
Set objSheet = objWorkbook.Sheets(1)

Set dictEN = CreateObject("Scripting.Dictionary")
Set dictVI = CreateObject("Scripting.Dictionary")
Set dictJP = CreateObject("Scripting.Dictionary")

lastRow = objSheet.UsedRange.Rows.Count

' Bỏ dòng đầu tiên (header)
For row = 2 To lastRow
    key   = Trim(objSheet.Cells(row, 1).Value)
    valEN = objSheet.Cells(row, 2).Value
    valVI = objSheet.Cells(row, 3).Value
    valJP = objSheet.Cells(row, 4).Value
    If key <> "" Then
        InsertNestedKey dictEN, Split(key, "."), valEN
        InsertNestedKey dictVI, Split(key, "."), valVI
        InsertNestedKey dictJP, Split(key, "."), valJP
    End If
Next

jsonEN = ConvertToJSON(dictEN, 0)
jsonVI = ConvertToJSON(dictVI, 0)
jsonJP = ConvertToJSON(dictJP, 0)

Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objFileEN = objFSO.CreateTextFile("en.json", True, True)
Set objFileVI = objFSO.CreateTextFile("vi.json", True, True)
Set objFileJP = objFSO.CreateTextFile("jp.json", True, True)

objFileEN.Write ChrW(&HFEFF) & jsonEN ' UTF-8 BOM
objFileVI.Write ChrW(&HFEFF) & jsonVI
objFileJP.Write ChrW(&HFEFF) & jsonJP

objFileEN.Close
objFileVI.Close
objFileJP.Close
objWorkbook.Close False
objExcel.Quit

WScript
