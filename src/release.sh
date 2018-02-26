#!/bin/bash

folder='../dmp-release'

mails='./mailFolder'

tmp='./temp'

name=`cat package.json |grep '"name"' |awk -F '"' '{print $4}'`

version=`cat package.json |grep '"version"' |awk -F '"' '{print $4}'`

name=$name-V$version

if [ ! -e $folder ]; then
	mkdir $folder
fi

if [ -e $folder/$name ]; then
	rm -rf $folder/$name/*
else
	mkdir $folder/$name
fi

cp dmp.js node_modules package.json README install.sh $folder/$name/ -r

cd $folder/

mkdir $name/$mails

mkdir $name/$tmp

zip -q -r $name.zip $name/*

rm -rf $name

echo "$folder/$name.zip"

