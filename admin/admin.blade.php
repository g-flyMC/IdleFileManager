@extends('layouts.admin')

@section('title')
IDE File Manager
@endsection

@section('content-header')
<h1>IDE File Manager<small>Extension Settings</small></h1>
<ol class="breadcrumb">
  <li><a href="{{ route('admin.index') }}">Admin</a></li>
  <li class="active">Extensions</li>
  <li class="active">IDE File Manager</li>
</ol>
@endsection

@section('content')
<div class="row">
  <div class="col-xs-12">
    <div class="box box-primary">
      <div class="box-header with-border">
        <h3 class="box-title">IDE File Manager</h3>
      </div>
      <div class="box-body">
        <p>The IDE File Manager extension is installed and active.</p>
        <p>Features:</p>
        <ul>
          <li>VS Code-style file tree with expandable directories</li>
          <li>Multi-tab editor with syntax-aware color schemes</li>
          <li>Create, rename, and delete files and folders</li>
          <li>Binary file detection (prevents opening incompatible files)</li>
          <li>Save files with Ctrl+S</li>
        </ul>
        <p><strong>Access:</strong> Navigate to any server → click "IDE" in the sub-navigation bar (or "More" button if using Nebula).</p>
      </div>
    </div>
  </div>
</div>
@endsection