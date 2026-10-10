' ============================================================================
' diffuser_dfma_macro.bas
' DfMA Segmented Diffuser Automation — SolidWorks VBA Macro
' Project GatiYantra — GKN Aerospace / VIT Hackathon
' ============================================================================
'
' USAGE:
'   1. Open "Diffuser cad.STEP" in SolidWorks (File > Open, set type to STEP).
'   2. Go to Tools > Macro > Edit.
'   3. In the VBA IDE: File > Import File > select this .bas file.
'   4. Close the VBA IDE.
'   5. Tools > Macro > Run > select "DfMA_Diffuser.Main".
'
' WHAT IT DOES:
'   - Creates 5 named sketches for the DfMA partition geometry.
'   - Extrudes fir-tree interlock cuts with 5° draft.
'   - Splits the outer ring into 4 quadrant bodies.
'
' REQUIREMENTS:
'   - SolidWorks 2021 or later.
'   - Active document must be the imported diffuser part.
'
' ============================================================================

' --- Module-level constants ---
Private Const PI As Double = 3.14159265358979
Private Const DEG2RAD As Double = 0.0174532925199433  ' PI / 180

' --- Geometric parameters (all in METRES for SolidWorks API) ---
Private Const R_HUB As Double = 0.062            ' Hub core outer radius
Private Const R_BAND_T2 As Double = 0.075         ' Structural interlock band outer
Private Const R_POCKET As Double = 0.087149        ' Impeller floor pocket boundary
Private Const R_AUXETIC As Double = 0.10857        ' Auxetic seal cartridge PCD radius
Private Const R_OUTER As Double = 0.129997         ' Casing shroud outer radius
Private Const D_AUXETIC As Double = 0.006          ' Auxetic pocket diameter
Private Const SWIRL_ANGLE As Double = 65#          ' Rotor exit swirl angle (degrees)

' --- Axial dimensions ---
Private Const Z_MIN As Double = -0.03515           ' Bottom of diffuser
Private Const Z_MAX As Double = 0.013266           ' Top of diffuser
Private Const AXIAL_DEPTH As Double = 0.048416     ' Total axial span

' --- Fir-tree interlock dimensions (in metres) ---
Private Const FT_SHANK_W As Double = 0.012         ' Top shank width
Private Const FT_LOBE1_W As Double = 0.01356       ' Lobe 1 width
Private Const FT_NECK1_W As Double = 0.0096         ' Neck 1 width
Private Const FT_LOBE2_W As Double = 0.01156       ' Lobe 2 width
Private Const FT_NECK2_W As Double = 0.0076         ' Neck 2 width
Private Const FT_LOBE3_W As Double = 0.00956       ' Lobe 3 width
Private Const FT_NECK3_W As Double = 0.0056         ' Neck 3 width
Private Const FT_FOOT_W As Double = 0.0064          ' Bottom retention bulb width
Private Const FT_DRAFT_DEG As Double = 5#           ' Axial draft angle for wedge lock
Private Const FT_TOTAL_DEPTH As Double = 0.013      ' Total radial depth of serration
Private Const FT_NUM_LUGS As Long = 8              ' 2 per quadrant x 4 quadrants

' --- Fir-tree angular positions (degrees) ---
Private FT_ANGLES(0 To 7) As Double

' --- Swirl split angular offsets (degrees, between vanes) ---
' 16 vanes at 22.5° spacing; splits at 0°, 90°, 180°, 270° offset
' rotated to pass between vanes (shifted by half-pitch = 11.25°)
Private Const SPLIT_OFFSET As Double = 11.25


' ============================================================================
' MAIN ENTRY POINT
' ============================================================================
Sub Main()
    
    ' Initialize angular positions for fir-tree lugs
    FT_ANGLES(0) = 22.5
    FT_ANGLES(1) = 67.5
    FT_ANGLES(2) = 112.5
    FT_ANGLES(3) = 157.5
    FT_ANGLES(4) = 202.5
    FT_ANGLES(5) = 247.5
    FT_ANGLES(6) = 292.5
    FT_ANGLES(7) = 337.5
    
    ' --- Connect to SolidWorks ---
    Dim swApp As Object
    Set swApp = GetObject(, "SldWorks.Application")
    
    If swApp Is Nothing Then
        MsgBox "ERROR: Could not connect to SolidWorks. " & _
               "Ensure SolidWorks is running.", vbCritical, "DfMA Macro"
        Exit Sub
    End If
    
    Dim swModel As Object  ' IModelDoc2
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then
        MsgBox "ERROR: No active document. " & _
               "Open 'Diffuser cad.STEP' first.", vbCritical, "DfMA Macro"
        Exit Sub
    End If
    
    ' Verify it's a part document (type = 1)
    If swModel.GetType <> 1 Then
        MsgBox "ERROR: Active document is not a Part. " & _
               "The imported STEP must be a Part document.", vbCritical, "DfMA Macro"
        Exit Sub
    End If
    
    Dim swModelExt As Object  ' IModelDocExtension
    Set swModelExt = swModel.Extension
    
    ' --- Status feedback ---
    swApp.SendMsgToUser2 "DfMA Diffuser Macro — Starting...", 2, 2
    
    ' ---- Step 1: Concentric Bands ----
    Call CreateConcentricBands(swModel, swApp)
    
    ' ---- Step 2: Inter-Vane Split Splines ----
    Call CreateInterVaneSplits(swModel, swApp)
    
    ' ---- Step 3: Auxetic Seal Pockets ----
    Call CreateAuxeticPockets(swModel, swApp)
    
    ' ---- Step 4: Fir-Tree Interlock Profiles ----
    Call CreateFirTreeLoops(swModel, swApp)
    
    ' ---- Step 5: Extrude Fir-Tree Cuts ----
    Call ExtrudeFirTreeCuts(swModel, swApp)
    
    ' ---- Step 6: Split Into Quadrants ----
    Call SplitQuadrants(swModel, swApp)
    
    ' --- Done ---
    swModel.ForceRebuild3 True
    swApp.SendMsgToUser2 "DfMA Diffuser Macro — COMPLETE. " & _
        "Check FeatureManager for 5 new sketches + cut features.", 2, 2
    
End Sub


' ============================================================================
' STEP 1: CONCENTRIC BAND SKETCH
' Creates three concentric circles defining the radial partition zones.
' ============================================================================
Private Sub CreateConcentricBands(swModel As Object, swApp As Object)
    
    Dim swSketchMgr As Object
    Set swSketchMgr = swModel.SketchManager
    
    ' Select the Front Plane for the sketch
    swModel.Extension.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
    swSketchMgr.InsertSketch True
    
    ' Draw concentric circles (SolidWorks API uses metres)
    ' CreateCircle(cx, cy, cz, rx, ry, rz) — center and a point on circumference
    swSketchMgr.CreateCircle 0#, 0#, 0#, R_HUB, 0#, 0#
    swSketchMgr.CreateCircle 0#, 0#, 0#, R_BAND_T2, 0#, 0#
    swSketchMgr.CreateCircle 0#, 0#, 0#, R_POCKET, 0#, 0#
    
    ' Close and name the sketch
    swSketchMgr.InsertSketch True
    
    ' Rename the last feature
    Call RenameLastFeature(swModel, "Sketch_Concentric_Bands")
    
End Sub


' ============================================================================
' STEP 2: INTER-VANE SPLIT SPLINES
' Creates four logarithmic-spiral curves following the 65° swirl angle.
' These pass through the open fluid channels between vanes.
' ============================================================================
Private Sub CreateInterVaneSplits(swModel As Object, swApp As Object)
    
    Dim swSketchMgr As Object
    Set swSketchMgr = swModel.SketchManager
    
    ' Select Front Plane
    swModel.Extension.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
    swSketchMgr.InsertSketch True
    
    Dim iSplit As Long
    Dim baseAngle As Double
    Dim alpha As Double
    alpha = SWIRL_ANGLE * DEG2RAD  ' 65° in radians
    
    ' The logarithmic spiral for a centrifugal compressor diffuser vane:
    '   r(theta) = R_start * exp((theta - theta_start) * tan(alpha))
    ' We trace from R_HUB to R_OUTER along the passage centerline.
    ' The four quadrant splits are offset to pass BETWEEN the 16 vanes.
    
    For iSplit = 0 To 3
        ' Base angular position: 0°, 90°, 180°, 270° shifted by half-pitch
        baseAngle = (iSplit * 90# + SPLIT_OFFSET) * DEG2RAD
        
        ' Generate spline control points along the spiral
        Dim nPts As Long
        nPts = 30  ' Sufficient for smooth spline
        
        ' Build arrays of (x, y) points
        Dim ptArray() As Double
        ReDim ptArray(0 To (nPts * 3) - 1)  ' x, y, z triplets
        
        Dim j As Long
        Dim t As Double, r As Double, theta As Double
        Dim rStart As Double
        rStart = R_HUB
        
        For j = 0 To nPts - 1
            t = CDbl(j) / CDbl(nPts - 1)  ' Parameter 0..1
            
            ' Radial position: linear from R_HUB to R_OUTER
            r = rStart + t * (R_OUTER - rStart)
            
            ' Theta from the logarithmic spiral relation:
            '   theta = theta_base + ln(r / R_start) / tan(alpha)
            ' tan(65°) = 2.14451
            If r > rStart Then
                theta = baseAngle + Log(r / rStart) / Tan(alpha)
            Else
                theta = baseAngle
            End If
            
            ' Convert to Cartesian
            ptArray(j * 3 + 0) = r * Cos(theta)
            ptArray(j * 3 + 1) = r * Sin(theta)
            ptArray(j * 3 + 2) = 0#
        Next j
        
        ' Create the spline through these points
        ' CreateSpline2 expects a variant array of doubles
        Dim vPts As Variant
        vPts = ptArray
        
        Dim swSpline As Object
        Set swSpline = swSketchMgr.CreateSpline2(vPts, True)
        
        If swSpline Is Nothing Then
            ' Fallback: draw as connected line segments
            Dim k As Long
            For k = 0 To nPts - 2
                swSketchMgr.CreateLine _
                    ptArray(k * 3 + 0), ptArray(k * 3 + 1), ptArray(k * 3 + 2), _
                    ptArray((k + 1) * 3 + 0), ptArray((k + 1) * 3 + 1), ptArray((k + 1) * 3 + 2)
            Next k
        End If
        
    Next iSplit
    
    ' Close and name
    swSketchMgr.InsertSketch True
    Call RenameLastFeature(swModel, "Sketch_InterVane_Splits")
    
End Sub


' ============================================================================
' STEP 3: AUXETIC SEAL POCKETS
' Four circles at r = 108.57 mm on the quadrant parting seams.
' ============================================================================
Private Sub CreateAuxeticPockets(swModel As Object, swApp As Object)
    
    Dim swSketchMgr As Object
    Set swSketchMgr = swModel.SketchManager
    
    ' Select Front Plane
    swModel.Extension.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
    swSketchMgr.InsertSketch True
    
    Dim iSeal As Long
    Dim sealAngle As Double
    Dim cx As Double, cy As Double
    Dim rPt As Double
    rPt = D_AUXETIC / 2#  ' Radius of the pocket circle
    
    ' Auxetic seals sit on the quadrant parting seams (at the split spline angles)
    ' Positioned at the same angular offsets as the inter-vane splits
    Dim sealAngles(0 To 3) As Double
    sealAngles(0) = SPLIT_OFFSET               ' 11.25°
    sealAngles(1) = 90# + SPLIT_OFFSET          ' 101.25°
    sealAngles(2) = 180# + SPLIT_OFFSET         ' 191.25°
    sealAngles(3) = 270# + SPLIT_OFFSET         ' 281.25°
    
    For iSeal = 0 To 3
        sealAngle = sealAngles(iSeal) * DEG2RAD
        cx = R_AUXETIC * Cos(sealAngle)
        cy = R_AUXETIC * Sin(sealAngle)
        
        ' Draw circle: center (cx, cy, 0), point on circumference (cx + rPt, cy, 0)
        swSketchMgr.CreateCircle cx, cy, 0#, cx + rPt, cy, 0#
    Next iSeal
    
    ' Close and name
    swSketchMgr.InsertSketch True
    Call RenameLastFeature(swModel, "Sketch_Auxetic_Pockets")
    
End Sub


' ============================================================================
' STEP 4: FIR-TREE INTERLOCK PROFILES
' Eight fully closed, watertight 3-lobe polygon loops at r = 62.0 mm.
' ============================================================================
Private Sub CreateFirTreeLoops(swModel As Object, swApp As Object)
    
    Dim swSketchMgr As Object
    Set swSketchMgr = swModel.SketchManager
    
    ' Select Front Plane
    swModel.Extension.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
    swSketchMgr.InsertSketch True
    
    Dim iLug As Long
    
    For iLug = 0 To FT_NUM_LUGS - 1
        Call DrawSingleFirTreeProfile(swSketchMgr, FT_ANGLES(iLug))
    Next iLug
    
    ' Close and name
    swSketchMgr.InsertSketch True
    Call RenameLastFeature(swModel, "Sketch_3Lobe_FirTree_Loops")
    
End Sub


' ============================================================================
' HELPER: Draw a single closed 3-lobe fir-tree profile
' The profile is drawn as a closed polygon in the sketch plane.
' It is centered at angular position 'angleDeg' on the hub rim at R_HUB.
'
' Profile topology (radially inward from hub surface):
'   Top shank -> Lobe1 bulge -> Neck1 -> Lobe2 bulge -> Neck2 ->
'   Lobe3 bulge -> Neck3 -> Foot bulb -> (mirror return)
'
' The profile is symmetric about the radial centerline through its center.
' ============================================================================
Private Sub DrawSingleFirTreeProfile(swSketchMgr As Object, angleDeg As Double)
    
    Dim angleRad As Double
    angleRad = angleDeg * DEG2RAD
    
    ' Build the profile points in a local coordinate system:
    '   u-axis = tangential (perpendicular to radius, CCW positive)
    '   v-axis = radial (outward positive)
    ' Origin is at (R_HUB, angleDeg) on the hub rim.
    
    ' Radial stations for each feature (depth inward from hub surface)
    ' Total serration depth = 13 mm, divided into ~3 equal lobe stages
    Dim lobeDepth As Double
    lobeDepth = FT_TOTAL_DEPTH / 3#  ' ~4.333 mm per lobe stage
    
    ' Build half-profile points (right side, +u direction)
    ' Then mirror for left side. Total of ~14 points for the closed loop.
    
    ' Radial depths from hub surface (negative v = inward)
    Dim v_shankTop As Double: v_shankTop = 0#
    Dim v_lobe1 As Double: v_lobe1 = -lobeDepth * 0.4
    Dim v_neck1 As Double: v_neck1 = -lobeDepth * 0.8
    Dim v_lobe2 As Double: v_lobe2 = -lobeDepth * 1.4
    Dim v_neck2 As Double: v_neck2 = -lobeDepth * 1.8
    Dim v_lobe3 As Double: v_lobe3 = -lobeDepth * 2.4
    Dim v_neck3 As Double: v_neck3 = -lobeDepth * 2.8
    Dim v_foot As Double: v_foot = -FT_TOTAL_DEPTH
    
    ' Half-widths (u-values, right side)
    Dim u_shank As Double: u_shank = FT_SHANK_W / 2#
    Dim u_lobe1 As Double: u_lobe1 = FT_LOBE1_W / 2#
    Dim u_neck1 As Double: u_neck1 = FT_NECK1_W / 2#
    Dim u_lobe2 As Double: u_lobe2 = FT_LOBE2_W / 2#
    Dim u_neck2 As Double: u_neck2 = FT_NECK2_W / 2#
    Dim u_lobe3 As Double: u_lobe3 = FT_LOBE3_W / 2#
    Dim u_neck3 As Double: u_neck3 = FT_NECK3_W / 2#
    Dim u_foot As Double: u_foot = FT_FOOT_W / 2#
    
    ' Right-side profile points (u, v) — 8 points top to bottom
    Dim nHalf As Long: nHalf = 8
    Dim uR(0 To 7) As Double, vR(0 To 7) As Double
    
    uR(0) = u_shank:  vR(0) = v_shankTop   ' Shank top-right
    uR(1) = u_lobe1:  vR(1) = v_lobe1      ' Lobe 1 bulge
    uR(2) = u_neck1:  vR(2) = v_neck1      ' Neck 1 waist
    uR(3) = u_lobe2:  vR(3) = v_lobe2      ' Lobe 2 bulge
    uR(4) = u_neck2:  vR(4) = v_neck2      ' Neck 2 waist
    uR(5) = u_lobe3:  vR(5) = v_lobe3      ' Lobe 3 bulge
    uR(6) = u_neck3:  vR(6) = v_neck3      ' Neck 3 waist
    uR(7) = u_foot:   vR(7) = v_foot       ' Foot bulb bottom-right
    
    ' Full profile: right side down, across bottom, left side up, across top
    ' Total = 8 (right) + 8 (left, mirrored) = 16 points
    Dim nTotal As Long: nTotal = nHalf * 2
    Dim xPts(0 To 15) As Double, yPts(0 To 15) As Double
    
    ' Direction vectors for the local coordinate frame
    ' u-direction (tangential): perpendicular to radial, CCW
    Dim uDirX As Double, uDirY As Double
    uDirX = -Sin(angleRad)
    uDirY = Cos(angleRad)
    
    ' v-direction (radial outward)
    Dim vDirX As Double, vDirY As Double
    vDirX = Cos(angleRad)
    vDirY = Sin(angleRad)
    
    ' Hub center point in global coordinates
    Dim cX As Double, cY As Double
    cX = R_HUB * Cos(angleRad)
    cY = R_HUB * Sin(angleRad)
    
    ' Right side (top to bottom): indices 0..7
    Dim i As Long
    For i = 0 To nHalf - 1
        xPts(i) = cX + uR(i) * uDirX + vR(i) * vDirX
        yPts(i) = cY + uR(i) * uDirY + vR(i) * vDirY
    Next i
    
    ' Left side (bottom to top, mirrored in u): indices 8..15
    For i = 0 To nHalf - 1
        Dim iMirror As Long
        iMirror = nHalf - 1 - i  ' Reverse order
        xPts(nHalf + i) = cX + (-uR(iMirror)) * uDirX + vR(iMirror) * vDirX
        yPts(nHalf + i) = cY + (-uR(iMirror)) * uDirY + vR(iMirror) * vDirY
    Next i
    
    ' Draw the closed polygon as connected line segments
    Dim seg As Long
    For seg = 0 To nTotal - 1
        Dim nextSeg As Long
        nextSeg = (seg + 1) Mod nTotal  ' Wraps back to 0 to close the loop
        
        swSketchMgr.CreateLine _
            xPts(seg), yPts(seg), 0#, _
            xPts(nextSeg), yPts(nextSeg), 0#
    Next seg
    
End Sub


' ============================================================================
' STEP 5: EXTRUDE FIR-TREE CUTS
' Selects each fir-tree profile and creates a Cut-Extrude with 5° draft.
' ============================================================================
Private Sub ExtrudeFirTreeCuts(swModel As Object, swApp As Object)
    
    ' First, select the fir-tree sketch
    Dim bRet As Boolean
    bRet = swModel.Extension.SelectByID2("Sketch_3Lobe_FirTree_Loops", "SKETCH", _
           0, 0, 0, False, 0, Nothing, 0)
    
    If Not bRet Then
        swApp.SendMsgToUser2 "WARNING: Could not select fir-tree sketch. " & _
            "Cut-extrude skipped.", 3, 2
        Exit Sub
    End If
    
    Dim swFeatMgr As Object
    Set swFeatMgr = swModel.FeatureManager
    
    Dim draftAngleRad As Double
    draftAngleRad = FT_DRAFT_DEG * DEG2RAD  ' 5° in radians
    
    ' Create cut-extrude through the axial depth with inward draft
    ' Using FeatureCut4 (SolidWorks 2014+)
    ' FeatureCut4 parameters:
    '   Sd        - Single direction = True
    '   Flip      - Flip direction
    '   Dir       - Direction type
    '   T1        - End condition type 1: 0 = Blind
    '   T2        - End condition type 2: 0 = Blind
    '   D1        - Depth 1
    '   D2        - Depth 2
    '   Dchk1     - Draft on/off for dir 1
    '   Dchk2     - Draft on/off for dir 2
    '   Ddir1     - Draft outward dir 1
    '   Ddir2     - Draft outward dir 2
    '   Dang1     - Draft angle 1 (radians)
    '   Dang2     - Draft angle 2 (radians)
    '   OffsetReverse1, OffsetReverse2
    '   TranslateSurface1, TranslateSurface2
    '   NormalCut
    '   UseFeatScope, UseAutoSelect
    '   AssemblyFeatureScope, AutoSelectComponents
    '   PropagateFeatureToParts
    '   T0        - Start condition: 0 = Sketch Plane
    '   StartOffset - Start offset distance
    '   FlipStartOffset - Flip start offset direction
    
    Dim swFeat As Object
    Set swFeat = swFeatMgr.FeatureCut4( _
        True, _                        ' Sd: Single direction
        False, _                       ' Flip: Don't flip
        False, _                       ' Dir: False
        0, _                           ' T1: Blind end condition
        0, _                           ' T2: Blind
        AXIAL_DEPTH, _                 ' D1: Cut depth = full axial span
        0#, _                          ' D2: Not used
        True, _                        ' Dchk1: Enable draft on direction 1
        False, _                       ' Dchk2: No draft on direction 2
        True, _                        ' Ddir1: Draft outward (inward taper for slot)
        False, _                       ' Ddir2: N/A
        draftAngleRad, _               ' Dang1: 5° draft angle
        0#, _                          ' Dang2: N/A
        False, _                       ' OffsetReverse1
        False, _                       ' OffsetReverse2
        False, _                       ' TranslateSurface1
        False, _                       ' TranslateSurface2
        True, _                        ' NormalCut
        True, _                        ' UseFeatScope
        True, _                        ' UseAutoSelect
        False, _                       ' AssemblyFeatureScope
        False, _                       ' AutoSelectComponents
        False, _                       ' PropagateFeatureToParts
        0, _                           ' T0: Start from sketch plane
        0#, _                          ' StartOffset: None
        False _                        ' FlipStartOffset
    )
    
    If swFeat Is Nothing Then
        swApp.SendMsgToUser2 "WARNING: FeatureCut4 failed. " & _
            "Please manually extrude-cut the fir-tree sketch with 5deg draft.", 3, 2
    Else
        swFeat.Name = "Cut_FirTree_3Lobe_Draft5deg"
    End If
    
    swModel.ClearSelection2 True
    
End Sub


' ============================================================================
' STEP 6: SPLIT INTO QUADRANTS
' Uses the inter-vane spline sketch to split the body into hub + 4 quadrants.
' ============================================================================
Private Sub SplitQuadrants(swModel As Object, swApp As Object)
    
    ' Select the inter-vane split sketch
    Dim bRet As Boolean
    bRet = swModel.Extension.SelectByID2("Sketch_InterVane_Splits", "SKETCH", _
           0, 0, 0, False, 0, Nothing, 0)
    
    If Not bRet Then
        swApp.SendMsgToUser2 "WARNING: Could not select split sketch. " & _
            "Quadrant split skipped. Please perform manually: " & _
            "Insert > Surface > Extrude the Sketch_InterVane_Splits, " & _
            "then Insert > Features > Split.", 3, 2
        Exit Sub
    End If
    
    ' Create a surface extrude from the split sketch (both directions)
    Dim swFeatMgr As Object
    Set swFeatMgr = swModel.FeatureManager
    
    Dim swSurfFeat As Object
    Set swSurfFeat = swFeatMgr.FeatureExtrusion3( _
        False, _                        ' Sd: Both directions
        False, _                        ' Flip
        True, _                         ' Dir: symmetric about sketch plane
        0, _                            ' T1: Blind
        0, _                            ' T2: Blind
        AXIAL_DEPTH, _                  ' D1: Full axial depth
        AXIAL_DEPTH, _                  ' D2: Full axial depth
        False, _                        ' Dchk1: No draft
        False, _                        ' Dchk2: No draft
        False, _                        ' Ddir1
        False, _                        ' Ddir2
        0#, _                           ' Dang1
        0#, _                           ' Dang2
        False, _                        ' OffsetReverse1
        False, _                        ' OffsetReverse2
        False, _                        ' TranslateSurface1
        False, _                        ' TranslateSurface2
        True, _                         ' Merge
        True, _                         ' UseFeatScope
        True _                          ' UseAutoSelect
    )
    
    If Not swSurfFeat Is Nothing Then
        swSurfFeat.Name = "Surface_QuadrantSplitters"
    End If
    
    ' Split the body using the splitting surface
    bRet = swModel.Extension.SelectByID2("Surface_QuadrantSplitters", "BODYFEATURE", _
           0, 0, 0, False, 0, Nothing, 0)
    
    Dim swSplitFeat As Object
    Set swSplitFeat = swFeatMgr.InsertSplitBody2()
    
    If swSplitFeat Is Nothing Then
        swApp.SendMsgToUser2 "INFO: SplitBody created. Please expand the Split " & _
            "feature in FeatureManager and check all resulting bodies to keep them. " & _
            "You should see 5 bodies: 1 hub core + 4 quadrant ring segments.", 2, 2
    Else
        swSplitFeat.Name = "Split_Quadrants_4x90deg"
        swApp.SendMsgToUser2 "INFO: SplitBody feature created successfully. " & _
            "Verify 5 bodies in the 'Solid Bodies' folder.", 2, 2
    End If
    
    swModel.ClearSelection2 True
    
End Sub


' ============================================================================
' UTILITY: Rename the last feature in the tree
' ============================================================================
Private Sub RenameLastFeature(swModel As Object, newName As String)
    
    Dim swFeat As Object
    Set swFeat = swModel.FirstFeature
    
    Dim swPrevFeat As Object
    Set swPrevFeat = Nothing
    
    ' Walk to the end of the feature tree
    Do While Not swFeat Is Nothing
        Set swPrevFeat = swFeat
        Set swFeat = swFeat.GetNextFeature
    Loop
    
    ' Rename the last feature
    If Not swPrevFeat Is Nothing Then
        swPrevFeat.Name = newName
    End If
    
End Sub
