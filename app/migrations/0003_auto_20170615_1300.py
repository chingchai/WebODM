# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-06-15 17:00
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0002_task_auto_processing_node'),
    ]

    operations = [
        migrations.AlterField(
            model_name='project',
            name='description',
            field=models.TextField(blank=True, default='', help_text='More in-depth description of the project'),
        ),
    ]
